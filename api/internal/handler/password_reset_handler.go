package handler

import (
	"context"
	"errors"
	"log"
	"net/http"

	"github.com/bolao-app/api/internal/auth"
	"github.com/bolao-app/api/internal/service"
	"github.com/gin-gonic/gin"
)

type passwordResetter interface {
	Request(ctx context.Context, login string) error
	Reset(ctx context.Context, token, passwordHash string) error
}

type PasswordResetHandler struct {
	resetter passwordResetter
}

func NewPasswordResetHandler(resetter passwordResetter) *PasswordResetHandler {
	return &PasswordResetHandler{resetter: resetter}
}

type forgotPasswordRequest struct {
	Login string `json:"login"`
}

type resetPasswordRequest struct {
	Token       string `json:"token"`
	NewPassword string `json:"new_password"`
}

func (h *PasswordResetHandler) Forgot(c *gin.Context) {
	var req forgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err == nil {
		if err := h.resetter.Request(c.Request.Context(), req.Login); err != nil {
			log.Printf("password reset request: %v", err)
		}
	}
	c.Status(http.StatusNoContent)
}

func (h *PasswordResetHandler) Reset(c *gin.Context) {
	var req resetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": service.ErrInvalidResetToken.Error()})
		return
	}
	if len(req.NewPassword) < minPasswordLength {
		c.JSON(http.StatusBadRequest, gin.H{"error": "a senha deve ter no mínimo 8 caracteres"})
		return
	}
	hash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao processar senha"})
		return
	}
	err = h.resetter.Reset(c.Request.Context(), req.Token, hash)
	if errors.Is(err, service.ErrInvalidResetToken) {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}
