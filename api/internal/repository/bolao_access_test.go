package repository

import (
	"context"
	"testing"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

func TestBolaoRepository_ReadAccess(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	repo := NewBolaoRepository(pool)
	owner, member, stranger := newUser(t, pool), newUser(t, pool), newUser(t, pool)
	private, err := repo.CreateOwned(ctx, "Privado "+uuid.NewString()[:6], owner)
	if err != nil {
		t.Fatalf("CreateOwned: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(context.Background(), `DELETE FROM boloes WHERE id = $1`, private.ID) })
	if err := NewMembershipRepository(pool).Add(ctx, private.ID, member, models.MemberRoleParticipant, models.MemberStatusActive); err != nil {
		t.Fatalf("Add: %v", err)
	}
	legacy, err := repo.GetActive(ctx)
	if err != nil {
		t.Fatalf("GetActive: %v", err)
	}

	cases := []struct {
		name  string
		bolao uuid.UUID
		user  uuid.UUID
		want  bool
	}{
		{"the owner reads their bolão", private.ID, owner, true},
		{"a member reads it", private.ID, member, true},
		{"a stranger cannot read it", private.ID, stranger, false},
		{"anyone reads a season the platform runs", legacy.ID, stranger, true},
	}
	for _, c := range cases {
		got, err := repo.IsReadableBy(ctx, c.bolao, c.user)
		if err != nil || got != c.want {
			t.Errorf("%s: IsReadableBy = %v, %v; want %v", c.name, got, err, c.want)
		}
	}

	listed := func(user uuid.UUID) bool {
		boloes, err := repo.ListReadableBy(ctx, user)
		if err != nil {
			t.Fatalf("ListReadableBy: %v", err)
		}
		for _, b := range boloes {
			if b.ID == private.ID {
				return true
			}
		}
		return false
	}
	if !listed(member) || listed(stranger) {
		t.Errorf("listed for member = %v, stranger = %v; want true, false", listed(member), listed(stranger))
	}
}
