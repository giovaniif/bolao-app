package repository

import (
	"context"
	"testing"
)

func TestBolaoRepository_ListsOnlyVisiblePublicActiveBoloes(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	repo := NewBolaoRepository(pool)
	owner := newUser(t, pool)
	names := map[string]struct {
		visibility string
		hidden     bool
		finished   bool
	}{
		"Público aberto":    {"public", false, false},
		"Privado":           {"private", false, false},
		"Público oculto":    {"public", true, false},
		"Público encerrado": {"public", false, true},
	}
	for name, cfg := range names {
		b, err := repo.CreateOwned(ctx, name, owner)
		if err != nil {
			t.Fatalf("CreateOwned: %v", err)
		}
		t.Cleanup(func() { _, _ = pool.Exec(context.Background(), `DELETE FROM boloes WHERE id = $1`, b.ID) })
		if err := repo.UpdateSettings(ctx, b.ID, name, cfg.visibility, true); err != nil {
			t.Fatalf("UpdateSettings: %v", err)
		}
		if cfg.hidden {
			if err := repo.SetHidden(ctx, b.ID, true); err != nil {
				t.Fatalf("SetHidden: %v", err)
			}
		}
		if cfg.finished {
			if err := repo.Finish(ctx, b.ID); err != nil {
				t.Fatalf("Finish: %v", err)
			}
		}
	}

	public, err := repo.ListPublic(ctx, "público", 20)
	if err != nil {
		t.Fatalf("ListPublic: %v", err)
	}
	if len(public) != 1 || public[0].Name != "Público aberto" || public[0].MemberCount != 1 {
		t.Errorf("public = %+v, want only Público aberto with 1 member", public)
	}
	owned, err := repo.CountOwnedActive(ctx, owner)
	if err != nil || owned != 3 {
		t.Errorf("CountOwnedActive = %d, %v; want 3 (the finished one does not count)", owned, err)
	}
}
