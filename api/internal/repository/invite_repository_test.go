package repository

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestInviteRepository_CodesFindTheBolaoAndRotate(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	b, err := NewBolaoRepository(pool).CreateOwned(ctx, "Convites", newUser(t, pool))
	if err != nil {
		t.Fatalf("CreateOwned: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(context.Background(), `DELETE FROM boloes WHERE id = $1`, b.ID) })
	repo := NewInviteRepository(pool)

	found, err := repo.FindByCode(ctx, b.InviteCode)
	if err != nil || found.ID != b.ID {
		t.Fatalf("FindByCode = %v, %v; want %v", found, err, b.ID)
	}
	if lower, err := repo.FindByCode(ctx, "  "+toLower(b.InviteCode)+" "); err != nil || lower.ID != b.ID {
		t.Errorf("a lower-case code with spaces = %v, %v; want the bolão", lower, err)
	}
	code, err := repo.RotateCode(ctx, b.ID)
	if err != nil || code == b.InviteCode {
		t.Fatalf("RotateCode = %q, %v; want a new code", code, err)
	}
	if _, err := repo.FindByCode(ctx, b.InviteCode); err == nil {
		t.Error("the old code still finds the bolão")
	}
}

func TestInviteRepository_LinksExpireAndRunOut(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	owner := newUser(t, pool)
	b, err := NewBolaoRepository(pool).CreateOwned(ctx, "Links", owner)
	if err != nil {
		t.Fatalf("CreateOwned: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(context.Background(), `DELETE FROM boloes WHERE id = $1`, b.ID) })
	repo := NewInviteRepository(pool)
	one := 1

	token, err := repo.CreateLink(ctx, b.ID, owner, time.Now().Add(time.Hour), &one)
	if err != nil || len(token) < 20 {
		t.Fatalf("CreateLink = %q, %v", token, err)
	}
	bolaoID, err := repo.UseLink(ctx, token, time.Now())
	if err != nil || bolaoID != b.ID {
		t.Fatalf("first use = %v, %v; want %v", bolaoID, err, b.ID)
	}
	if _, err := repo.UseLink(ctx, token, time.Now()); !errors.Is(err, ErrInviteUnavailable) {
		t.Errorf("second use: err = %v, want ErrInviteUnavailable", err)
	}

	expired, err := repo.CreateLink(ctx, b.ID, owner, time.Now().Add(time.Hour), nil)
	if err != nil {
		t.Fatalf("CreateLink: %v", err)
	}
	if _, err := repo.UseLink(ctx, expired, time.Now().Add(2*time.Hour)); !errors.Is(err, ErrInviteUnavailable) {
		t.Errorf("expired use: err = %v, want ErrInviteUnavailable", err)
	}
	if found, err := repo.FindLink(ctx, expired); err != nil || found != b.ID {
		t.Errorf("FindLink = %v, %v; want the bolão without using the link", found, err)
	}
}

func toLower(s string) string {
	out := []rune(s)
	for i, r := range out {
		if r >= 'A' && r <= 'Z' {
			out[i] = r + 32
		}
	}
	return string(out)
}
