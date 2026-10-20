package handler

import (
	"net/http"

	"github.com/bolao-app/api/internal/service"
	"github.com/gin-gonic/gin"
)

func GetRules(c *gin.Context) {
	c.Header("Cache-Control", "public, max-age=3600")
	c.JSON(http.StatusOK, service.Rules())
}
