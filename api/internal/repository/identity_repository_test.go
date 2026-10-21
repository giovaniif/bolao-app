package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
)

func TestIdentityRepository_CreateSocialAccountAndFindIt(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	repo := NewIdentityRepository(pool)
	name := "soc_" + uuid.NewString()[:8]
	subject := "sub-" + uuid.NewString()

	user, err := repo.CreateSocialAccount(ctx, name, name+"@Example.com", "google", subject)
	if err != nil {
		t.Fatalf("CreateSocialAccount: %v", err)
	}
	if user.Username != name || user.MustChangePassword {
		t.Errorf("user = %+v, want %s without a forced password change", user, name)
	}
	got, err := repo.UserIDByIdentity(ctx, "google", subject)
	if err != nil || got != user.ID {
		t.Errorf("UserIDByIdentity = %v, %v; want %v", got, err, user.ID)
	}
	byEmail, err := repo.UserIDByEmail(ctx, name+"@example.COM")
	if err != nil || byEmail != user.ID {
		t.Errorf("UserIDByEmail = %v, %v; want %v", byEmail, err, user.ID)
	}
	if _, err := repo.CreateSocialAccount(ctx, name, "", "apple", "other-"+subject); !errors.Is(err, ErrUsernameTaken) {
		t.Errorf("same username: err = %v, want ErrUsernameTaken", err)
	}
	if _, err := repo.UserIDByIdentity(ctx, "apple", "other-"+subject); !errors.Is(err, ErrIdentityNotFound) {
		t.Errorf("rolled back identity: err = %v, want ErrIdentityNotFound", err)
	}
}

func TestIdentityRepository_LinkIdentityIsIdempotent(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	repo := NewIdentityRepository(pool)
	name := "lnk_" + uuid.NewString()[:8]
	user, err := NewUserRepository(pool).CreateAccount(ctx, name, "Link", name+"@example.com", "hash")
	if err != nil {
		t.Fatalf("CreateAccount: %v", err)
	}
	subject := "sub-" + uuid.NewString()
	for i := 0; i < 2; i++ {
		if err := repo.LinkIdentity(ctx, user.ID, "apple", subject, "relay@privaterelay.appleid.com"); err != nil {
			t.Fatalf("LinkIdentity %d: %v", i, err)
		}
	}
	got, err := repo.UserIDByIdentity(ctx, "apple", subject)
	if err != nil || got != user.ID {
		t.Errorf("UserIDByIdentity = %v, %v; want %v", got, err, user.ID)
	}
}
