package handler

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/bolao-app/api/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type fakeCompetitions []models.Competition

func (f fakeCompetitions) ListActive(context.Context) ([]models.Competition, error) { return f, nil }

func TestCompetitionHandler_ListsTheActiveCompetitions(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/competitions", NewCompetitionHandler(fakeCompetitions{{ID: uuid.New(), Name: "Brasileirão Série A 2026", ProviderCode: "BSA", Season: 2026, Status: "active"}}).List)

	w := do(t, r, http.MethodGet, "/api/competitions", "", nil)
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"provider_code":"BSA"`) {
		t.Errorf("status = %d body = %s", w.Code, w.Body)
	}
}
