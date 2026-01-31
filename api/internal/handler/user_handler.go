package handler

import (
	"net/http"
	"strings"

	"github.com/bolao-app/api/internal/constants"
	"github.com/bolao-app/api/internal/models"
	"github.com/bolao-app/api/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type UserHandler struct {
	userRepo *repository.UserRepository
}

func NewUserHandler(userRepo *repository.UserRepository) *UserHandler {
	return &UserHandler{userRepo: userRepo}
}

type CreateUserRequest struct {
	Username     string  `json:"username" binding:"required"`
	DisplayName  string  `json:"display_name" binding:"required"`
	FavoriteTeam *string `json:"favorite_team"`
	IsAdmin      bool    `json:"is_admin"`
}

type UpdateUserRequest struct {
	Username     *string  `json:"username"`
	DisplayName  string   `json:"display_name"`
	FavoriteTeam *string  `json:"favorite_team"`
	AmountPaid   *float64 `json:"amount_paid"`
}

type UpdateMeRequest struct {
	Username     string  `json:"username"`
	DisplayName  string  `json:"display_name"`
	FavoriteTeam *string `json:"favorite_team"`
}

func (h *UserHandler) List(c *gin.Context) {
	users, err := h.userRepo.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if users == nil {
		users = []models.User{}
	}
	c.JSON(http.StatusOK, users)
}

func (h *UserHandler) Create(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.FavoriteTeam != nil && !contains(constants.Teams, *req.FavoriteTeam) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "time inválido. Selecione um dos 20 times do Brasileirão 2026"})
		return
	}

	user := &models.User{
		ID:           uuid.New(),
		Username:     req.Username,
		DisplayName:  req.DisplayName,
		FavoriteTeam: req.FavoriteTeam,
		IsAdmin:      req.IsAdmin,
		AmountPaid:   0,
	}

	if err := h.userRepo.Create(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "username já existe"})
		return
	}

	c.JSON(http.StatusCreated, user)
}

func (h *UserHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.userRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "usuário não encontrado"})
		return
	}

	if req.Username != nil {
		username := strings.TrimSpace(*req.Username)
		if username == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "username não pode ser vazio"})
			return
		}
		existing, _ := h.userRepo.GetByUsernameExcluding(c.Request.Context(), username, id)
		if existing != nil {
			c.JSON(http.StatusConflict, gin.H{"error": "username já existe"})
			return
		}
		user.Username = username
	}
	if req.DisplayName != "" {
		user.DisplayName = req.DisplayName
	}
	if req.FavoriteTeam != nil {
		if !contains(constants.Teams, *req.FavoriteTeam) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "time inválido"})
			return
		}
		user.FavoriteTeam = req.FavoriteTeam
	}
	if req.AmountPaid != nil {
		user.AmountPaid = *req.AmountPaid
	}

	if err := h.userRepo.Update(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, user)
}

func (h *UserHandler) GetMe(c *gin.Context) {
	userIDVal, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "não autenticado"})
		return
	}
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}
	user, err := h.userRepo.GetByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "usuário não encontrado"})
		return
	}
	c.JSON(http.StatusOK, user)
}

func (h *UserHandler) UpdateMe(c *gin.Context) {
	userIDVal, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "não autenticado"})
		return
	}
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}

	var req UpdateMeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.userRepo.GetByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "usuário não encontrado"})
		return
	}

	username := strings.TrimSpace(req.Username)
	if username == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username é obrigatório"})
		return
	}
	existing, _ := h.userRepo.GetByUsernameExcluding(c.Request.Context(), username, userID)
	if existing != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "username já existe"})
		return
	}
	user.Username = username

	displayName := strings.TrimSpace(req.DisplayName)
	if displayName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "nome é obrigatório"})
		return
	}
	user.DisplayName = displayName

	if req.FavoriteTeam != nil {
		if *req.FavoriteTeam != "" && !contains(constants.Teams, *req.FavoriteTeam) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "time inválido"})
			return
		}
		if *req.FavoriteTeam == "" {
			user.FavoriteTeam = nil
		} else {
			user.FavoriteTeam = req.FavoriteTeam
		}
	}

	if err := h.userRepo.Update(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, user)
}

func (h *UserHandler) GetTeams(c *gin.Context) {
	c.JSON(http.StatusOK, constants.Teams)
}

func contains(s []string, e string) bool {
	for _, a := range s {
		if a == e {
			return true
		}
	}
	return false
}
