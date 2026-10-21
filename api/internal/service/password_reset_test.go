package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

var resetNow = time.Date(2026, 10, 21, 12, 0, 0, 0, time.UTC)

type storedResetToken struct {
	userID    uuid.UUID
	hash      string
	createdAt time.Time
	expiresAt time.Time
	used      bool
}

type fakeResetStore struct {
	users     map[string]*models.User
	tokens    []*storedResetToken
	passwords map[uuid.UUID]string
}

func newFakeResetStore(users ...*models.User) *fakeResetStore {
	f := &fakeResetStore{users: map[string]*models.User{}, passwords: map[uuid.UUID]string{}}
	for _, u := range users {
		f.users[u.Username] = u
	}
	return f
}

func (f *fakeResetStore) FindByLogin(_ context.Context, login string) (*models.User, error) {
	for _, u := range f.users {
		if u.Username == login || (u.Email != nil && strings.EqualFold(*u.Email, login)) {
			return u, nil
		}
	}
	return nil, errors.New("no rows")
}

func (f *fakeResetStore) LatestResetTokenAt(_ context.Context, userID uuid.UUID) (*time.Time, error) {
	var latest *time.Time
	for _, tok := range f.tokens {
		if tok.userID == userID && (latest == nil || tok.createdAt.After(*latest)) {
			created := tok.createdAt
			latest = &created
		}
	}
	return latest, nil
}

func (f *fakeResetStore) CreateResetToken(_ context.Context, userID uuid.UUID, tokenHash string, createdAt, expiresAt time.Time) error {
	f.tokens = append(f.tokens, &storedResetToken{userID: userID, hash: tokenHash, createdAt: createdAt, expiresAt: expiresAt})
	return nil
}

func (f *fakeResetStore) ResetPassword(_ context.Context, tokenHash string, now time.Time, passwordHash string) (bool, error) {
	for _, tok := range f.tokens {
		if tok.hash == tokenHash && !tok.used && now.Before(tok.expiresAt) {
			tok.used = true
			f.passwords[tok.userID] = passwordHash
			return true, nil
		}
	}
	return false, nil
}

type sentMail struct {
	to, subject, html, text string
}

type fakeMailer struct {
	sent []sentMail
}

func (m *fakeMailer) Send(_ context.Context, to, subject, html, text string) error {
	m.sent = append(m.sent, sentMail{to, subject, html, text})
	return nil
}

func withEmail(username, email string) *models.User {
	return &models.User{ID: uuid.New(), Username: username, DisplayName: "Maria", Email: &email}
}

func newResetService(store *fakeResetStore, mailer Mailer, clock *time.Time) *PasswordResetService {
	n := 0
	return NewPasswordResetService(store, mailer, "https://bolao.example", func() time.Time { return *clock }, func() (string, error) {
		n++
		return "token" + string(rune('0'+n)), nil
	})
}

func hashOf(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func TestPasswordReset_Request(t *testing.T) {
	tests := []struct {
		name      string
		user      *models.User
		login     string
		wantMails int
	}{
		{"a user found by username gets an email", withEmail("maria", "maria@example.com"), "maria", 1},
		{"a user found by email in any case gets an email", withEmail("maria", "maria@example.com"), "Maria@Example.com", 1},
		{"surrounding spaces in the login are ignored", withEmail("maria", "maria@example.com"), "  maria ", 1},
		{"an unknown login sends nothing", withEmail("maria", "maria@example.com"), "joao", 0},
		{"a user without email gets nothing", &models.User{ID: uuid.New(), Username: "antigo"}, "antigo", 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			clock := resetNow
			mailer := &fakeMailer{}
			store := newFakeResetStore(tt.user)
			if err := newResetService(store, mailer, &clock).Request(context.Background(), tt.login); err != nil {
				t.Fatalf("Request: err = %v, want nil", err)
			}
			if len(mailer.sent) != tt.wantMails || len(store.tokens) != tt.wantMails {
				t.Errorf("mails = %d tokens = %d, want %d", len(mailer.sent), len(store.tokens), tt.wantMails)
			}
		})
	}
}

func TestPasswordReset_RequestSendsALinkWithTheTokenAndStoresOnlyItsHash(t *testing.T) {
	clock := resetNow
	mailer := &fakeMailer{}
	store := newFakeResetStore(withEmail("maria", "maria@example.com"))
	if err := newResetService(store, mailer, &clock).Request(context.Background(), "maria"); err != nil {
		t.Fatal(err)
	}
	mail := mailer.sent[0]
	link := "https://bolao.example/redefinir-senha?token=token1"
	if mail.to != "maria@example.com" || mail.subject == "" || !strings.Contains(mail.html, link) || !strings.Contains(mail.text, link) {
		t.Errorf("mail = %+v, want to maria@example.com with %s", mail, link)
	}
	tok := store.tokens[0]
	if tok.hash != hashOf("token1") {
		t.Errorf("stored hash = %s, want sha256 of the token", tok.hash)
	}
	if !tok.expiresAt.Equal(resetNow.Add(time.Hour)) {
		t.Errorf("expires = %v, want one hour after %v", tok.expiresAt, resetNow)
	}
}

func TestPasswordReset_RequestIgnoresASecondRequestWithinAMinute(t *testing.T) {
	clock := resetNow
	mailer := &fakeMailer{}
	store := newFakeResetStore(withEmail("maria", "maria@example.com"))
	svc := newResetService(store, mailer, &clock)
	ctx := context.Background()
	_ = svc.Request(ctx, "maria")
	clock = resetNow.Add(59 * time.Second)
	_ = svc.Request(ctx, "maria")
	if len(mailer.sent) != 1 {
		t.Fatalf("mails after 59s = %d, want 1", len(mailer.sent))
	}
	clock = resetNow.Add(61 * time.Second)
	_ = svc.Request(ctx, "maria")
	if len(mailer.sent) != 2 {
		t.Errorf("mails after 61s = %d, want 2", len(mailer.sent))
	}
}

func TestPasswordReset_RequestWithoutMailerDoesNothing(t *testing.T) {
	clock := resetNow
	store := newFakeResetStore(withEmail("maria", "maria@example.com"))
	if err := newResetService(store, nil, &clock).Request(context.Background(), "maria"); err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(store.tokens) != 0 {
		t.Errorf("tokens = %d, want 0 when email is disabled", len(store.tokens))
	}
}

func TestPasswordReset_Reset(t *testing.T) {
	tests := []struct {
		name    string
		token   string
		advance time.Duration
		wantErr error
	}{
		{"a fresh token sets the password", "token1", 30 * time.Minute, nil},
		{"an unknown token is refused", "other", 0, ErrInvalidResetToken},
		{"an expired token is refused", "token1", time.Hour + time.Second, ErrInvalidResetToken},
		{"an empty token is refused", "", 0, ErrInvalidResetToken},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			user := withEmail("maria", "maria@example.com")
			clock := resetNow
			store := newFakeResetStore(user)
			svc := newResetService(store, &fakeMailer{}, &clock)
			_ = svc.Request(context.Background(), "maria")
			clock = resetNow.Add(tt.advance)
			err := svc.Reset(context.Background(), tt.token, "newhash")
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if tt.wantErr == nil && store.passwords[user.ID] != "newhash" {
				t.Errorf("password = %q, want newhash", store.passwords[user.ID])
			}
		})
	}
}

func TestPasswordReset_ATokenWorksOnlyOnce(t *testing.T) {
	clock := resetNow
	store := newFakeResetStore(withEmail("maria", "maria@example.com"))
	svc := newResetService(store, &fakeMailer{}, &clock)
	_ = svc.Request(context.Background(), "maria")
	if err := svc.Reset(context.Background(), "token1", "h1"); err != nil {
		t.Fatalf("first reset: %v", err)
	}
	if err := svc.Reset(context.Background(), "token1", "h2"); !errors.Is(err, ErrInvalidResetToken) {
		t.Errorf("second reset: err = %v, want ErrInvalidResetToken", err)
	}
}
