package handler

import (
	"net/http"
	"strconv"

	"github.com/bolao-app/api/internal/service"
	"github.com/gin-gonic/gin"
)

type ClassificationHandler struct {
	classificationSvc *service.ClassificationService
}

func NewClassificationHandler(classificationSvc *service.ClassificationService) *ClassificationHandler {
	return &ClassificationHandler{classificationSvc: classificationSvc}
}

func (h *ClassificationHandler) Get(c *gin.Context) {
	roundStr := c.DefaultQuery("round", "0")
	round, err := strconv.Atoi(roundStr)
	if err != nil || round < 0 {
		round = 999
	}

	classification, err := h.classificationSvc.GetClassification(c.Request.Context(), round)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, classification)
}

func (h *ClassificationHandler) GetByPartials(c *gin.Context) {
	roundStr := c.Param("round")
	round, err := strconv.Atoi(roundStr)
	if err != nil || round < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "rodada inválida"})
		return
	}

	classification, err := h.classificationSvc.GetClassificationByPartials(c.Request.Context(), round)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, classification)
}
