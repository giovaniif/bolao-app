package handler

import (
	"net/http"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRulesNeedNoLogin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/rules", GetRules)
	w := do(t, r, http.MethodGet, "/api/rules", "", nil)
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"key":"correct_draw","points":12`) {
		t.Errorf("status = %d body = %s", w.Code, w.Body)
	}
}
