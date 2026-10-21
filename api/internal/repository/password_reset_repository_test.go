package repository

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestPasswordResetRepository_ResetsOnceBeforeExpiry(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	users := NewUserRepository(pool)
	repo := NewPasswordResetRepository(pool)
	name := "reset_" + uuid.NewString()[:8]
	user, err := users.CreateAccount(ctx, name, "Reset", name+"@Example.com", "old")
	if err != nil {
		t.Fatalf("CreateAccount: %v", err)
	}
	if _, err := pool.Exec(ctx, `UPDATE users SET must_change_password = true WHERE id = $1`, user.ID); err != nil {
		t.Fatal(err)
	}

	byEmail, err := repo.FindByLogin(ctx, name+"@example.COM")
	if err != nil || byEmail.ID != user.ID || byEmail.Email == nil {
		t.Fatalf("FindByLogin(email) = %+v, %v; want the user with its email", byEmail, err)
	}
	if byName, err := repo.FindByLogin(ctx, name); err != nil || byName.ID != user.ID {
		t.Fatalf("FindByLogin(username) = %+v, %v", byName, err)
	}

	now := time.Now().UTC().Truncate(time.Second)
	if latest, err := repo.LatestResetTokenAt(ctx, user.ID); err != nil || latest != nil {
		t.Fatalf("LatestResetTokenAt before = %v, %v; want nil", latest, err)
	}
	hash := "h_" + uuid.NewString()
	if err := repo.CreateResetToken(ctx, user.ID, hash, now, now.Add(time.Hour)); err != nil {
		t.Fatalf("CreateResetToken: %v", err)
	}
	if latest, err := repo.LatestResetTokenAt(ctx, user.ID); err != nil || latest == nil || !latest.Equal(now) {
		t.Errorf("LatestResetTokenAt = %v, %v; want %v", latest, err, now)
	}

	if ok, err := repo.ResetPassword(ctx, hash, now.Add(2*time.Hour), "late"); err != nil || ok {
		t.Errorf("expired reset = %v, %v; want false", ok, err)
	}
	if ok, err := repo.ResetPassword(ctx, hash, now.Add(time.Minute), "new"); err != nil || !ok {
		t.Fatalf("reset = %v, %v; want true", ok, err)
	}
	if ok, _ := repo.ResetPassword(ctx, hash, now.Add(time.Minute), "again"); ok {
		t.Error("a used token reset the password again")
	}
	got, err := users.GetByID(ctx, user.ID)
	if err != nil || got.PasswordHash != "new" || got.MustChangePassword {
		t.Errorf("user = %+v, %v; want hash new and no forced change", got, err)
	}
}
