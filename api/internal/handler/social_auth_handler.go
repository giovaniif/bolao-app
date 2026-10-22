package handler

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/bolao-app/api/internal/auth"
	"github.com/bolao-app/api/internal/models"
	"github.com/bolao-app/api/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type IDTokenVerifier interface {
	Verify(ctx context.Context, idToken string) (auth.Identity, error)
}

type socialAccountStore interface {
	GetByID(ctx context.Context, id uuid.UUID) (*models.User, error)
	UserIDByIdentity(ctx context.Context, provider, subject string) (uuid.UUID, error)
	UserIDByEmail(ctx context.Context, email string) (uuid.UUID, error)
	LinkIdentity(ctx context.Context, userID uuid.UUID, provider, subject, email string) error
	CreateSocialAccount(ctx context.Context, username, email, provider, subject string) (*models.User, error)
	UsernameExists(ctx context.Context, username string) (bool, error)
}

var socialProviders = map[string]bool{"apple": true, "google": true}

type SocialAuthHandler struct {
	store     socialAccountStore
	verifiers map[string]IDTokenVerifier
	jwtSecret string
}

func NewSocialAuthHandler(store socialAccountStore, verifiers map[string]IDTokenVerifier, jwtSecret string) *SocialAuthHandler {
	return &SocialAuthHandler{store: store, verifiers: verifiers, jwtSecret: jwtSecret}
}

type SocialLoginRequest struct {
	Provider string `json:"provider" binding:"required"`
	IDToken  string `json:"id_token" binding:"required"`
	Username string `json:"username"`
	Name     string `json:"name"`
}

func (h *SocialAuthHandler) Login(c *gin.Context) {
	var req SocialLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "dados inválidos"})
		return
	}
	if !socialProviders[req.Provider] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provedor de login desconhecido"})
		return
	}
	verifier, ok := h.verifiers[req.Provider]
	if !ok || verifier == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "este login não está disponível"})
		return
	}
	ctx := c.Request.Context()
	identity, err := verifier.Verify(ctx, req.IDToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "login inválido, tente novamente"})
		return
	}

	userID, err := h.store.UserIDByIdentity(ctx, req.Provider, identity.Subject)
	if err == nil {
		h.login(c, http.StatusOK, userID)
		return
	}
	if !errors.Is(err, repository.ErrIdentityNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if identity.EmailVerified && identity.Email != "" {
		userID, err := h.store.UserIDByEmail(ctx, identity.Email)
		if err == nil {
			if err := h.store.LinkIdentity(ctx, userID, req.Provider, identity.Subject, identity.Email); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			h.login(c, http.StatusOK, userID)
			return
		}
		if !errors.Is(err, repository.ErrIdentityNotFound) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	username := strings.ToLower(strings.TrimSpace(req.Username))
	if username == "" {
		email := ""
		if identity.EmailVerified {
			email = identity.Email
		}
		suggested, err := suggestUsername(ctx, usernameBase(email, req.Name), h.store.UsernameExists)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusConflict, gin.H{"needs_username": true, "error": "escolha um nome de usuário", "suggested_username": suggested})
		return
	}
	if !usernamePattern.MatchString(username) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "o nome de usuário deve ter de 3 a 30 letras, números, ponto ou _"})
		return
	}
	email := ""
	if identity.EmailVerified {
		email = identity.Email
	}
	user, err := h.store.CreateSocialAccount(ctx, username, email, req.Provider, identity.Subject)
	if errors.Is(err, repository.ErrEmailTaken) {
		user, err = h.store.CreateSocialAccount(ctx, username, "", req.Provider, identity.Subject)
	}
	if errors.Is(err, repository.ErrUsernameTaken) {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.respond(c, http.StatusCreated, user)
}

func (h *SocialAuthHandler) UsernameAvailable(c *gin.Context) {
	username := strings.ToLower(strings.TrimSpace(c.Query("username")))
	valid := usernamePattern.MatchString(username)
	available := false
	if valid {
		exists, err := h.store.UsernameExists(c.Request.Context(), username)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		available = !exists
	}
	c.JSON(http.StatusOK, gin.H{"valid": valid, "available": available})
}

func (h *SocialAuthHandler) login(c *gin.Context, status int, userID uuid.UUID) {
	user, err := h.store.GetByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "usuário não encontrado"})
		return
	}
	h.respond(c, status, user)
}

func (h *SocialAuthHandler) respond(c *gin.Context, status int, user *models.User) {
	token, err := auth.GenerateToken(user.ID, user.Username, user.IsAdmin, h.jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao gerar token"})
		return
	}
	c.JSON(status, LoginResponse{
		Token:    token,
		UserID:   user.ID.String(),
		Username: user.Username,
		IsAdmin:  user.IsAdmin,
	})
}
