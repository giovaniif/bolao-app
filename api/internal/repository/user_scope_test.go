package repository

import (
	"context"
	"testing"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

func TestUserRepository_ListsOnlyPeopleWhoShareAnActiveBolao(t *testing.T) {
	pool, members, bolaoID := membershipFixture(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `UPDATE boloes SET status = 'active' WHERE id = $1`, bolaoID); err != nil {
		t.Fatalf("activate: %v", err)
	}
	me, friend, pending, stranger := newUser(t, pool), newUser(t, pool), newUser(t, pool), newUser(t, pool)
	for user, status := range map[uuid.UUID]string{me: models.MemberStatusActive, friend: models.MemberStatusActive, pending: models.MemberStatusPending} {
		if err := members.Add(ctx, bolaoID, user, models.MemberRoleParticipant, status); err != nil {
			t.Fatalf("Add: %v", err)
		}
	}

	users, err := NewUserRepository(pool).ListSharingBolaoWith(ctx, me)
	if err != nil {
		t.Fatalf("ListSharingBolaoWith: %v", err)
	}
	seen := map[uuid.UUID]bool{}
	for _, u := range users {
		seen[u.ID] = true
	}
	if !seen[me] || !seen[friend] || seen[pending] || seen[stranger] {
		t.Errorf("seen = me %v, friend %v, pending %v, stranger %v; want me and friend only", seen[me], seen[friend], seen[pending], seen[stranger])
	}
}
