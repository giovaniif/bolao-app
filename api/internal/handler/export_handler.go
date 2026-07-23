package handler

import (
	"net/http"
	"strconv"

	"github.com/bolao-app/api/internal/repository"
	"github.com/bolao-app/api/internal/service"
	"github.com/gin-gonic/gin"
)

type ExportHandler struct {
	exportSvc *service.ExportService
	bolaoRepo *repository.BolaoRepository
}

func NewExportHandler(exportSvc *service.ExportService, bolaoRepo *repository.BolaoRepository) *ExportHandler {
	return &ExportHandler{exportSvc: exportSvc, bolaoRepo: bolaoRepo}
}

func (h *ExportHandler) ExportRound(c *gin.Context) {
	roundStr := c.Param("round")
	round, err := strconv.Atoi(roundStr)
	if err != nil || round < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "rodada inválida"})
		return
	}

	bolaoID, err := resolveBolaoID(c, h.bolaoRepo)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bolão inválido"})
		return
	}

	csvData, err := h.exportSvc.ExportRoundCSV(c.Request.Context(), bolaoID, round)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	filename := "bolao_rodada_" + roundStr + ".csv"
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Data(http.StatusOK, "text/csv; charset=utf-8", csvData)
}

func (h *ExportHandler) ExportAll(c *gin.Context) {
	bolaoID, err := resolveBolaoID(c, h.bolaoRepo)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bolão inválido"})
		return
	}

	csvData, err := h.exportSvc.ExportAllCSV(c.Request.Context(), bolaoID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=bolao_todas_rodadas.csv")
	c.Data(http.StatusOK, "text/csv; charset=utf-8", csvData)
}
