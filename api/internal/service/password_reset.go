package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"html"
	"net/url"
	"strings"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

const (
	ResetTokenLifetime = time.Hour
	ResetRequestPause  = time.Minute
)

var ErrInvalidResetToken = errors.New("link inválido ou expirado")

type PasswordResetStore interface {
	FindByLogin(ctx context.Context, login string) (*models.User, error)
	LatestResetTokenAt(ctx context.Context, userID uuid.UUID) (*time.Time, error)
	CreateResetToken(ctx context.Context, userID uuid.UUID, tokenHash string, createdAt, expiresAt time.Time) error
	ResetPassword(ctx context.Context, tokenHash string, now time.Time, passwordHash string) (bool, error)
}

type Mailer interface {
	Send(ctx context.Context, to, subject, html, text string) error
}

type PasswordResetService struct {
	store    PasswordResetStore
	mailer   Mailer
	appURL   string
	now      func() time.Time
	newToken func() (string, error)
}

func NewPasswordResetService(store PasswordResetStore, mailer Mailer, appURL string, now func() time.Time, newToken func() (string, error)) *PasswordResetService {
	return &PasswordResetService{store: store, mailer: mailer, appURL: strings.TrimRight(appURL, "/"), now: now, newToken: newToken}
}

func RandomResetToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func HashResetToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func (s *PasswordResetService) Request(ctx context.Context, login string) error {
	login = strings.TrimSpace(login)
	if s.mailer == nil || login == "" {
		return nil
	}
	user, err := s.store.FindByLogin(ctx, login)
	if err != nil || user.Email == nil || *user.Email == "" {
		return nil
	}
	now := s.now()
	latest, err := s.store.LatestResetTokenAt(ctx, user.ID)
	if err != nil {
		return err
	}
	if latest != nil && now.Sub(*latest) < ResetRequestPause {
		return nil
	}
	token, err := s.newToken()
	if err != nil {
		return err
	}
	if err := s.store.CreateResetToken(ctx, user.ID, HashResetToken(token), now, now.Add(ResetTokenLifetime)); err != nil {
		return err
	}
	link := s.appURL + "/redefinir-senha?token=" + url.QueryEscape(token)
	subject, htmlBody, textBody := resetEmail(user.DisplayName, link)
	return s.mailer.Send(ctx, *user.Email, subject, htmlBody, textBody)
}

func resetEmail(name, link string) (string, string, string) {
	subject := "Redefina sua senha do Bolão"
	text := fmt.Sprintf("Olá, %s!\n\nRecebemos um pedido para redefinir sua senha do Bolão. Abra o link abaixo para criar uma nova senha. Ele vale por 1 hora.\n\n%s\n\nSe você não pediu, ignore este e-mail.\n", name, link)
	htmlBody := fmt.Sprintf(`<p>Olá, %s!</p><p>Recebemos um pedido para redefinir sua senha do Bolão. O link vale por 1 hora.</p><p><a href="%s">Criar nova senha</a></p><p>Ou copie este endereço: %s</p><p>Se você não pediu, ignore este e-mail.</p>`,
		html.EscapeString(name), html.EscapeString(link), html.EscapeString(link))
	return subject, htmlBody, text
}

func (s *PasswordResetService) Reset(ctx context.Context, token, passwordHash string) error {
	if token == "" {
		return ErrInvalidResetToken
	}
	ok, err := s.store.ResetPassword(ctx, HashResetToken(token), s.now(), passwordHash)
	if err != nil {
		return err
	}
	if !ok {
		return ErrInvalidResetToken
	}
	return nil
}
