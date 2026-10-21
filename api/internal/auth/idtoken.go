package auth

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	AppleJWKSURL  = "https://appleid.apple.com/auth/keys"
	GoogleJWKSURL = "https://www.googleapis.com/oauth2/v3/certs"

	jwksCacheTTL = 6 * time.Hour
)

var (
	AppleIssuers  = []string{"https://appleid.apple.com"}
	GoogleIssuers = []string{"accounts.google.com", "https://accounts.google.com"}
)

type Identity struct {
	Subject       string
	Email         string
	EmailVerified bool
}

type IDTokenVerifier struct {
	jwksURL   string
	issuers   []string
	audiences []string
	client    *http.Client

	mu        sync.Mutex
	keys      map[string]*rsa.PublicKey
	fetchedAt time.Time
}

func NewIDTokenVerifier(jwksURL string, issuers, audiences []string, client *http.Client) *IDTokenVerifier {
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	return &IDTokenVerifier{jwksURL: jwksURL, issuers: issuers, audiences: audiences, client: client}
}

type idTokenClaims struct {
	Email         string `json:"email"`
	EmailVerified any    `json:"email_verified"`
	jwt.RegisteredClaims
}

func (v *IDTokenVerifier) Verify(ctx context.Context, raw string) (Identity, error) {
	var claims idTokenClaims
	_, err := jwt.ParseWithClaims(raw, &claims, func(t *jwt.Token) (any, error) {
		kid, _ := t.Header["kid"].(string)
		return v.key(ctx, kid)
	}, jwt.WithValidMethods([]string{"RS256"}), jwt.WithExpirationRequired())
	if err != nil {
		return Identity{}, fmt.Errorf("%w: %v", ErrInvalidToken, err)
	}
	if !slices.Contains(v.issuers, claims.Issuer) {
		return Identity{}, fmt.Errorf("%w: issuer %q", ErrInvalidToken, claims.Issuer)
	}
	if !slices.ContainsFunc(claims.Audience, func(a string) bool { return slices.Contains(v.audiences, a) }) {
		return Identity{}, fmt.Errorf("%w: audience %v", ErrInvalidToken, claims.Audience)
	}
	if claims.Subject == "" {
		return Identity{}, fmt.Errorf("%w: no subject", ErrInvalidToken)
	}
	return Identity{
		Subject:       claims.Subject,
		Email:         strings.ToLower(strings.TrimSpace(claims.Email)),
		EmailVerified: claims.EmailVerified == true || claims.EmailVerified == "true",
	}, nil
}

func (v *IDTokenVerifier) key(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	v.mu.Lock()
	defer v.mu.Unlock()
	if k, ok := v.keys[kid]; ok && time.Since(v.fetchedAt) < jwksCacheTTL {
		return k, nil
	}
	keys, err := v.fetch(ctx)
	if err != nil {
		return nil, err
	}
	v.keys, v.fetchedAt = keys, time.Now()
	if k, ok := v.keys[kid]; ok {
		return k, nil
	}
	return nil, errors.New("unknown key id")
}

func (v *IDTokenVerifier) fetch(ctx context.Context) (map[string]*rsa.PublicKey, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.jwksURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := v.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("jwks: status %d", resp.StatusCode)
	}
	var set struct {
		Keys []struct {
			Kty string `json:"kty"`
			Kid string `json:"kid"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&set); err != nil {
		return nil, err
	}
	keys := map[string]*rsa.PublicKey{}
	for _, k := range set.Keys {
		if k.Kty != "RSA" {
			continue
		}
		n, errN := base64.RawURLEncoding.DecodeString(k.N)
		e, errE := base64.RawURLEncoding.DecodeString(k.E)
		if errN != nil || errE != nil {
			continue
		}
		keys[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(n), E: int(new(big.Int).SetBytes(e).Int64())}
	}
	return keys, nil
}
