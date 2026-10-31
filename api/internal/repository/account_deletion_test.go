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

	if err := repo.DeleteAccount(ctx, user.ID, nil); err != nil {
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

	if err := NewUserRepository(pool).DeleteAccount(ctx, owner, nil); !errors.Is(err, ErrOwnsActiveBolao) {
		t.Errorf("err = %v, want ErrOwnsActiveBolao", err)
	}
}

func ownedBolaoWith(t *testing.T, name string, owner uuid.UUID, members map[uuid.UUID]string) uuid.UUID {
	t.Helper()
	pool := pushTestPool(t)
	ctx := context.Background()
	b, err := NewBolaoRepository(pool).CreateOwned(ctx, name, owner)
	if err != nil {
		t.Fatalf("CreateOwned: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(context.Background(), `DELETE FROM boloes WHERE id = $1`, b.ID) })
	for id, role := range members {
		if err := NewMembershipRepository(pool).Add(ctx, b.ID, id, role, models.MemberStatusActive); err != nil {
			t.Fatalf("Add: %v", err)
		}
	}
	return b.ID
}

func TestUserRepository_DeletionBlockersSuggestsTheAdmin(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	owner, member, admin := newUser(t, pool), newUser(t, pool), newUser(t, pool)
	bolaoID := ownedBolaoWith(t, "Com admin", owner, map[uuid.UUID]string{member: models.MemberRoleParticipant})
	if err := NewMembershipRepository(pool).Add(ctx, bolaoID, admin, models.MemberRoleAdmin, models.MemberStatusActive); err != nil {
		t.Fatalf("Add: %v", err)
	}

	blockers, err := NewUserRepository(pool).DeletionBlockers(ctx, owner)
	if err != nil {
		t.Fatalf("DeletionBlockers: %v", err)
	}
	if len(blockers) != 1 || blockers[0].BolaoID != bolaoID || blockers[0].SuggestedOwnerID != admin || len(blockers[0].Members) != 2 {
		t.Errorf("blockers = %+v, want one bolão suggesting the admin", blockers)
	}
}

func TestUserRepository_DeletionBlockersSuggestsTheOldestMemberWithoutAdmin(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	owner, first, second := newUser(t, pool), newUser(t, pool), newUser(t, pool)
	bolaoID := ownedBolaoWith(t, "Sem admin", owner, map[uuid.UUID]string{first: models.MemberRoleParticipant})
	if err := NewMembershipRepository(pool).Add(ctx, bolaoID, second, models.MemberRoleParticipant, models.MemberStatusActive); err != nil {
		t.Fatalf("Add: %v", err)
	}
	if _, err := pool.Exec(ctx, `UPDATE bolao_participants SET joined_at = joined_at + interval '1 hour' WHERE bolao_id = $1 AND user_id = $2`, bolaoID, second); err != nil {
		t.Fatalf("joined_at: %v", err)
	}

	blockers, err := NewUserRepository(pool).DeletionBlockers(ctx, owner)
	if err != nil {
		t.Fatalf("DeletionBlockers: %v", err)
	}
	if len(blockers) != 1 || blockers[0].SuggestedOwnerID != first {
		t.Errorf("blockers = %+v, want the oldest member suggested", blockers)
	}
}

func TestUserRepository_DeleteAccountHandsOverAndDeletesTogether(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	owner, friend := newUser(t, pool), newUser(t, pool)
	bolaoID := ownedBolaoWith(t, "Passa adiante", owner, map[uuid.UUID]string{friend: models.MemberRoleParticipant})

	if err := NewUserRepository(pool).DeleteAccount(ctx, owner, map[uuid.UUID]uuid.UUID{bolaoID: friend}); err != nil {
		t.Fatalf("DeleteAccount: %v", err)
	}

	var ownerID uuid.UUID
	var status, role string
	if err := pool.QueryRow(ctx, `SELECT b.owner_id, b.status, p.role FROM boloes b JOIN bolao_participants p ON p.bolao_id = b.id AND p.user_id = $2 WHERE b.id = $1`, bolaoID, friend).Scan(&ownerID, &status, &role); err != nil {
		t.Fatalf("read: %v", err)
	}
	if ownerID != friend || status != "active" || role != models.MemberRoleOwner {
		t.Errorf("owner = %v status = %s role = %s, want friend as owner of an active bolão", ownerID, status, role)
	}
	m, err := NewMembershipRepository(pool).Get(ctx, bolaoID, owner)
	if err != nil || m.Status != models.MemberStatusRemoved {
		t.Errorf("old owner membership = %+v, %v; want removed", m, err)
	}
}

func TestUserRepository_DeleteAccountChangesNothingWhenOneBolaoLacksAnOwner(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	owner, friend, other := newUser(t, pool), newUser(t, pool), newUser(t, pool)
	first := ownedBolaoWith(t, "Primeiro", owner, map[uuid.UUID]string{friend: models.MemberRoleParticipant})
	ownedBolaoWith(t, "Segundo", owner, map[uuid.UUID]string{other: models.MemberRoleParticipant})

	err := NewUserRepository(pool).DeleteAccount(ctx, owner, map[uuid.UUID]uuid.UUID{first: friend})

	var blocked *OwnershipBlockedError
	if !errors.As(err, &blocked) || !errors.Is(err, ErrOwnsActiveBolao) || len(blocked.Blockers) != 2 {
		t.Fatalf("err = %v, want OwnershipBlockedError listing both bolões", err)
	}
	var ownerID uuid.UUID
	if err := pool.QueryRow(ctx, `SELECT owner_id FROM boloes WHERE id = $1`, first).Scan(&ownerID); err != nil {
		t.Fatalf("read: %v", err)
	}
	if ownerID != owner {
		t.Errorf("owner = %v, want unchanged", ownerID)
	}
}

func TestUserRepository_DeleteAccountRejectsANewOwnerOutsideTheBolao(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	owner, friend, stranger := newUser(t, pool), newUser(t, pool), newUser(t, pool)
	bolaoID := ownedBolaoWith(t, "Fechado", owner, map[uuid.UUID]string{friend: models.MemberRoleParticipant})

	err := NewUserRepository(pool).DeleteAccount(ctx, owner, map[uuid.UUID]uuid.UUID{bolaoID: stranger})

	if !errors.Is(err, ErrOwnsActiveBolao) {
		t.Errorf("err = %v, want ErrOwnsActiveBolao", err)
	}
}
