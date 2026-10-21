package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func TestResolveBolaoID_WithoutAScopeOrABolaoIDIsAnErrorNotTheActiveBolao(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/api/classification", nil)
	c.Set("user_id", uuid.New())

	if _, err := resolveBolaoID(c, nil); err == nil {
		t.Fatal("want an error without a bolão, got none")
	}
}
