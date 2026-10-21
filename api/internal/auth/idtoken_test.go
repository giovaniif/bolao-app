package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type testIssuer struct {
	key     *rsa.PrivateKey
	kid     string
	server  *httptest.Server
	fetches atomic.Int32
}

func newTestIssuer(t *testing.T) *testIssuer {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	ti := &testIssuer{key: key, kid: "test-kid"}
	ti.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		ti.fetches.Add(1)
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": []map[string]string{{
			"kty": "RSA",
			"kid": ti.kid,
			"alg": "RS256",
			"use": "sig",
			"n":   base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
			"e":   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes()),
		}}})
	}))
	t.Cleanup(ti.server.Close)
	return ti
}

func (ti *testIssuer) sign(t *testing.T, claims jwt.MapClaims, kid string, key *rsa.PrivateKey) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = kid
	signed, err := token.SignedString(key)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return signed
}

func validClaims() jwt.MapClaims {
	return jwt.MapClaims{
		"iss":            "https://issuer.test",
		"aud":            "com.example.app",
		"sub":            "subject-1",
		"email":          "Joao@Example.com",
		"email_verified": "true",
		"exp":            time.Now().Add(time.Hour).Unix(),
		"iat":            time.Now().Unix(),
	}
}

func TestIDTokenVerifier(t *testing.T) {
	ti := newTestIssuer(t)
	otherKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	v := NewIDTokenVerifier(ti.server.URL, []string{"https://issuer.test", "issuer.test"}, []string{"com.example.app", "web.example"}, ti.server.Client())

	with := func(key string, value any) jwt.MapClaims {
		c := validClaims()
		if value == nil {
			delete(c, key)
		} else {
			c[key] = value
		}
		return c
	}

	tests := []struct {
		name   string
		token  string
		wantOK bool
	}{
		{"a token signed by the provider key is accepted", ti.sign(t, validClaims(), ti.kid, ti.key), true},
		{"the second allowed issuer spelling is accepted", ti.sign(t, with("iss", "issuer.test"), ti.kid, ti.key), true},
		{"any allowed audience is accepted", ti.sign(t, with("aud", "web.example"), ti.kid, ti.key), true},
		{"a token signed by another key is refused", ti.sign(t, validClaims(), ti.kid, otherKey), false},
		{"an unknown key id is refused", ti.sign(t, validClaims(), "other-kid", ti.key), false},
		{"a foreign issuer is refused", ti.sign(t, with("iss", "https://evil.test"), ti.kid, ti.key), false},
		{"a foreign audience is refused", ti.sign(t, with("aud", "com.evil.app"), ti.kid, ti.key), false},
		{"an expired token is refused", ti.sign(t, with("exp", time.Now().Add(-time.Hour).Unix()), ti.kid, ti.key), false},
		{"a token without subject is refused", ti.sign(t, with("sub", nil), ti.kid, ti.key), false},
		{"garbage is refused", "not-a-jwt", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := v.Verify(context.Background(), tt.token)
			if (err == nil) != tt.wantOK {
				t.Errorf("%s: err = %v, want ok %v", tt.name, err, tt.wantOK)
			}
		})
	}
}

func TestIDTokenVerifierReturnsTheIdentity(t *testing.T) {
	ti := newTestIssuer(t)
	v := NewIDTokenVerifier(ti.server.URL, []string{"https://issuer.test"}, []string{"com.example.app"}, ti.server.Client())
	id, err := v.Verify(context.Background(), ti.sign(t, validClaims(), ti.kid, ti.key))
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if id.Subject != "subject-1" || id.Email != "joao@example.com" || !id.EmailVerified {
		t.Errorf("identity = %+v, want subject-1, joao@example.com, verified", id)
	}
}

func TestIDTokenVerifierTreatsAnUnverifiedEmailAsUnverified(t *testing.T) {
	ti := newTestIssuer(t)
	v := NewIDTokenVerifier(ti.server.URL, []string{"https://issuer.test"}, []string{"com.example.app"}, ti.server.Client())
	c := validClaims()
	c["email_verified"] = false
	id, err := v.Verify(context.Background(), ti.sign(t, c, ti.kid, ti.key))
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if id.EmailVerified {
		t.Errorf("EmailVerified = true, want false")
	}
}

func TestIDTokenVerifierCachesTheKeys(t *testing.T) {
	ti := newTestIssuer(t)
	v := NewIDTokenVerifier(ti.server.URL, []string{"https://issuer.test"}, []string{"com.example.app"}, ti.server.Client())
	token := ti.sign(t, validClaims(), ti.kid, ti.key)
	for i := 0; i < 3; i++ {
		if _, err := v.Verify(context.Background(), token); err != nil {
			t.Fatalf("verify %d: %v", i, err)
		}
	}
	if got := ti.fetches.Load(); got != 1 {
		t.Errorf("JWKS fetches = %d, want 1", got)
	}
}

func TestIDTokenVerifierRefreshesTheKeysForANewKeyID(t *testing.T) {
	ti := newTestIssuer(t)
	v := NewIDTokenVerifier(ti.server.URL, []string{"https://issuer.test"}, []string{"com.example.app"}, ti.server.Client())
	if _, err := v.Verify(context.Background(), ti.sign(t, validClaims(), ti.kid, ti.key)); err != nil {
		t.Fatalf("verify: %v", err)
	}
	ti.kid = "rotated-kid"
	if _, err := v.Verify(context.Background(), ti.sign(t, validClaims(), "rotated-kid", ti.key)); err != nil {
		t.Errorf("verify after rotation: %v", err)
	}
}
