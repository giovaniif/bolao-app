package repository

import (
	"context"
	"testing"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestUserRepository_Create_GetByUsername(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, "postgres://postgres:postgres@localhost:5432/bolao_test?sslmode=disable")
	if err != nil {
		t.Skipf("database not available: %v", err)
	}
	defer pool.Close()

	repo := NewUserRepository(pool)
	user := &models.User{
		ID:          uuid.New(),
		Username:    "testuser_" + uuid.New().String()[:8],
		DisplayName: "Test User",
		IsAdmin:     false,
	}
	if err := repo.Create(ctx, user); err != nil {
		t.Fatalf("Create: %v", err)
	}

	got, err := repo.GetByUsername(ctx, user.Username)
	if err != nil {
		t.Fatalf("GetByUsername: %v", err)
	}
	if got.ID != user.ID || got.Username != user.Username {
		t.Errorf("got %+v, want %+v", got, user)
	}
}
