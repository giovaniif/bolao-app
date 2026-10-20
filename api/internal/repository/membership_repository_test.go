package repository

import (
	"context"
	"slices"
	"testing"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func membershipFixture(t *testing.T) (*pgxpool.Pool, *MembershipRepository, uuid.UUID) {
	t.Helper()
	pool := pushTestPool(t)
	ctx := context.Background()
	var bolaoID uuid.UUID
	if err := pool.QueryRow(ctx, `INSERT INTO boloes (name, status, invite_code) VALUES ('Amigos', 'finished', upper(substr(md5(random()::text), 1, 8))) RETURNING id`).Scan(&bolaoID); err != nil {
		t.Fatalf("bolão: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(context.Background(), `DELETE FROM boloes WHERE id = $1`, bolaoID) })
	return pool, NewMembershipRepository(pool), bolaoID
}

func newUser(t *testing.T, pool *pgxpool.Pool) uuid.UUID {
	t.Helper()
	u := &models.User{ID: uuid.New(), Username: "m_" + uuid.NewString()[:8], DisplayName: "Member"}
	if err := NewUserRepository(pool).Create(context.Background(), u); err != nil {
		t.Fatalf("user: %v", err)
	}
	return u.ID
}

func TestMembershipRepository_AddGetAndChange(t *testing.T) {
	pool, repo, bolaoID := membershipFixture(t)
	ctx := context.Background()
	user := newUser(t, pool)

	if err := repo.Add(ctx, bolaoID, user, models.MemberRoleParticipant, models.MemberStatusPending); err != nil {
		t.Fatalf("Add: %v", err)
	}
	if err := repo.SetStatus(ctx, bolaoID, user, models.MemberStatusActive); err != nil {
		t.Fatalf("SetStatus: %v", err)
	}
	if err := repo.SetRole(ctx, bolaoID, user, models.MemberRoleAdmin); err != nil {
		t.Fatalf("SetRole: %v", err)
	}
	m, err := repo.Get(ctx, bolaoID, user)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if m.Role != models.MemberRoleAdmin || m.Status != models.MemberStatusActive {
		t.Errorf("membership = %+v, want admin active", m)
	}
}

func TestMembershipRepository_ARemovedMemberCanRequestAgain(t *testing.T) {
	pool, repo, bolaoID := membershipFixture(t)
	ctx := context.Background()
	user := newUser(t, pool)
	if err := repo.Add(ctx, bolaoID, user, models.MemberRoleAdmin, models.MemberStatusActive); err != nil {
		t.Fatalf("Add: %v", err)
	}
	if err := repo.SetStatus(ctx, bolaoID, user, models.MemberStatusRemoved); err != nil {
		t.Fatalf("remove: %v", err)
	}

	if err := repo.Add(ctx, bolaoID, user, models.MemberRoleParticipant, models.MemberStatusPending); err != nil {
		t.Fatalf("Add again: %v", err)
	}
	m, err := repo.Get(ctx, bolaoID, user)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if m.Role != models.MemberRoleParticipant || m.Status != models.MemberStatusPending {
		t.Errorf("membership = %+v, want a pending participant", m)
	}
}

func TestMembershipRepository_CountsAndListsOnlyActiveMembers(t *testing.T) {
	pool, repo, bolaoID := membershipFixture(t)
	ctx := context.Background()
	active, pending, removed := newUser(t, pool), newUser(t, pool), newUser(t, pool)
	for user, status := range map[uuid.UUID]string{active: models.MemberStatusActive, pending: models.MemberStatusPending, removed: models.MemberStatusRemoved} {
		if err := repo.Add(ctx, bolaoID, user, models.MemberRoleParticipant, status); err != nil {
			t.Fatalf("Add: %v", err)
		}
	}

	count, err := repo.CountActive(ctx, bolaoID)
	if err != nil || count != 1 {
		t.Errorf("CountActive = %d, %v; want 1", count, err)
	}
	participants, err := NewBolaoRepository(pool).ListParticipants(ctx, bolaoID)
	if err != nil {
		t.Fatalf("ListParticipants: %v", err)
	}
	if len(participants) != 1 || participants[0].ID != active {
		t.Errorf("participants = %d, want only the active member", len(participants))
	}
	members, err := repo.ListByBolao(ctx, bolaoID)
	if err != nil {
		t.Fatalf("ListByBolao: %v", err)
	}
	statuses := []string{}
	for _, m := range members {
		statuses = append(statuses, m.Status)
	}
	slices.Sort(statuses)
	if !slices.Equal(statuses, []string{models.MemberStatusActive, models.MemberStatusPending}) {
		t.Errorf("member statuses = %v, want active and pending (no removed)", statuses)
	}
}

func TestMembershipRepository_ListsTheBoloesOfAUser(t *testing.T) {
	pool, repo, bolaoID := membershipFixture(t)
	ctx := context.Background()
	user, other := newUser(t, pool), newUser(t, pool)
	if err := repo.Add(ctx, bolaoID, user, models.MemberRoleOwner, models.MemberStatusActive); err != nil {
		t.Fatalf("Add: %v", err)
	}
	if err := repo.Add(ctx, bolaoID, other, models.MemberRoleParticipant, models.MemberStatusActive); err != nil {
		t.Fatalf("Add other: %v", err)
	}

	boloes, err := repo.ListBoloesOfUser(ctx, user)
	if err != nil {
		t.Fatalf("ListBoloesOfUser: %v", err)
	}
	if len(boloes) != 1 || boloes[0].ID != bolaoID || boloes[0].Role != models.MemberRoleOwner || boloes[0].MemberCount != 2 {
		t.Errorf("boloes = %+v, want Amigos as owner with 2 members", boloes)
	}
}

func TestPushRepository_SkipsMembersThatAreNotActive(t *testing.T) {
	pool, repo, bolaoID := membershipFixture(t)
	ctx := context.Background()
	user := newUser(t, pool)
	if err := repo.Add(ctx, bolaoID, user, models.MemberRoleParticipant, models.MemberStatusPending); err != nil {
		t.Fatalf("Add: %v", err)
	}
	if err := NewPushRepository(pool).Upsert(ctx, &models.PushSubscription{ID: uuid.New(), UserID: user, Endpoint: "https://push.example/" + uuid.NewString(), P256dh: "k", Auth: "a"}); err != nil {
		t.Fatalf("Upsert: %v", err)
	}

	subs, err := NewPushRepository(pool).ListForBolao(ctx, bolaoID)
	if err != nil {
		t.Fatalf("ListForBolao: %v", err)
	}
	if len(subs) != 0 {
		t.Errorf("subscriptions = %d, want 0 for a pending member", len(subs))
	}
}

func TestMembershipRepository_TransferOwnership(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	owner, next := newUser(t, pool), newUser(t, pool)
	b, err := NewBolaoRepository(pool).CreateOwned(ctx, "Transfer", owner)
	if err != nil {
		t.Fatalf("CreateOwned: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(context.Background(), `DELETE FROM boloes WHERE id = $1`, b.ID) })
	repo := NewMembershipRepository(pool)
	if err := repo.Add(ctx, b.ID, next, models.MemberRoleAdmin, models.MemberStatusActive); err != nil {
		t.Fatalf("Add: %v", err)
	}

	if err := repo.TransferOwnership(ctx, b.ID, owner, next); err != nil {
		t.Fatalf("TransferOwnership: %v", err)
	}

	got, err := NewBolaoRepository(pool).GetByID(ctx, b.ID)
	if err != nil || got.OwnerID == nil || *got.OwnerID != next {
		t.Errorf("owner = %v, %v; want %v", got.OwnerID, err, next)
	}
	for user, want := range map[uuid.UUID]string{owner: models.MemberRoleAdmin, next: models.MemberRoleOwner} {
		m, err := repo.Get(ctx, b.ID, user)
		if err != nil || m.Role != want {
			t.Errorf("role of %v = %+v, %v; want %s", user, m, err, want)
		}
	}
}
