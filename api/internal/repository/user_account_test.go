package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
)

func TestUserRepository_CreateAccountWithEmail(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	repo := NewUserRepository(pool)
	name := "acc_" + uuid.NewString()[:8]
	email := name + "@Example.com"

	user, err := repo.CreateAccount(ctx, name, "Conta Nova", email, "hash")
	if err != nil {
		t.Fatalf("CreateAccount: %v", err)
	}
	got, err := repo.GetByUsername(ctx, name)
	if err != nil || got.ID != user.ID || got.PasswordHash != "hash" || got.MustChangePassword || got.IsAdmin {
		t.Errorf("user = %+v, %v; want the account with its hash, no forced change, not admin", got, err)
	}
	if _, err := repo.CreateAccount(ctx, name, "Outro", "x"+email, "hash"); !errors.Is(err, ErrUsernameTaken) {
		t.Errorf("same username: err = %v, want ErrUsernameTaken", err)
	}
	if _, err := repo.CreateAccount(ctx, name+"2", "Outro", "  "+name+"@example.COM ", "hash"); !errors.Is(err, ErrEmailTaken) {
		t.Errorf("same email: err = %v, want ErrEmailTaken", err)
	}
}

func TestUserRepository_AUserWithoutPasswordCanBeRead(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	name := "nopass_" + uuid.NewString()[:8]
	if _, err := pool.Exec(ctx, `INSERT INTO users (username, display_name, must_change_password) VALUES ($1, 'Sem senha', false)`, name); err != nil {
		t.Fatalf("insert: %v", err)
	}
	got, err := NewUserRepository(pool).GetByUsername(ctx, name)
	if err != nil || got.PasswordHash != "" {
		t.Errorf("user = %+v, %v; want an empty hash", got, err)
	}
}
