package repository

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

func TestUserRepository_DeleteAccountAnonymizesAndLeavesEveryBolao(t *testing.T) {
	pool, members, bolaoID := membershipFixture(t)
	ctx := context.Background()
	repo := NewUserRepository(pool)
	user, err := repo.CreateAccount(ctx, "del_"+uuid.NewString()[:8], "Vou Sair", "del_"+uuid.NewString()[:8]+"@example.com", "hash")
	if err != nil {
		t.Fatalf("CreateAccount: %v", err)
	}
	if err := members.Add(ctx, bolaoID, user.ID, models.MemberRoleParticipant, models.MemberStatusActive); err != nil {
		t.Fatalf("Add: %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO user_identities (provider, subject, user_id) VALUES ('apple', $1, $2)`, uuid.NewString(), user.ID); err != nil {
		t.Fatalf("identity: %v", err)
	}

	if err := repo.DeleteAccount(ctx, user.ID); err != nil {
		t.Fatalf("DeleteAccount: %v", err)
	}

	got, err := repo.GetByID(ctx, user.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if got.DisplayName != "Conta excluída" || !strings.HasPrefix(got.Username, "excluido_") || got.PasswordHash != "" {
		t.Errorf("user = %+v, want an anonymized account without password", got)
	}
	var email *string
	var identities int
	if err := pool.QueryRow(ctx, `SELECT email, (SELECT COUNT(*) FROM user_identities WHERE user_id = $1) FROM users WHERE id = $1`, user.ID).Scan(&email, &identities); err != nil {
		t.Fatalf("read: %v", err)
	}
	if email != nil || identities != 0 {
		t.Errorf("email = %v identities = %d, want none", email, identities)
	}
	m, err := members.Get(ctx, bolaoID, user.ID)
	if err != nil || m.Status != models.MemberStatusRemoved {
		t.Errorf("membership = %+v, %v; want removed", m, err)
	}
}

func TestUserRepository_AnOwnerWithMembersMustHandOverFirst(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	owner, friend := newUser(t, pool), newUser(t, pool)
	b, err := NewBolaoRepository(pool).CreateOwned(ctx, "Tenho dono", owner)
	if err != nil {
		t.Fatalf("CreateOwned: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(context.Background(), `DELETE FROM boloes WHERE id = $1`, b.ID) })
	if err := NewMembershipRepository(pool).Add(ctx, b.ID, friend, models.MemberRoleParticipant, models.MemberStatusActive); err != nil {
		t.Fatalf("Add: %v", err)
	}

	if err := NewUserRepository(pool).DeleteAccount(ctx, owner); !errors.Is(err, ErrOwnsActiveBolao) {
		t.Errorf("err = %v, want ErrOwnsActiveBolao", err)
	}
}
