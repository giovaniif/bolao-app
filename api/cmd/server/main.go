package main

import (
	"context"
	"log"
	"os"
	"path/filepath"

	"github.com/bolao-app/api/internal/config"
	"github.com/bolao-app/api/internal/database"
	"github.com/bolao-app/api/internal/handler"
	"github.com/bolao-app/api/internal/repository"
	"github.com/bolao-app/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	_ = os.Setenv("TZ", "America/Sao_Paulo")

	cfg := config.Load()

	ctx := context.Background()
	pool, err := database.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()

	if err := runMigrations(ctx, pool); err != nil {
		log.Fatalf("migrations: %v", err)
	}

	userRepo := repository.NewUserRepository(pool)
	matchRepo := repository.NewMatchRepository(pool)
	predictionRepo := repository.NewPredictionRepository(pool)
	partialRepo := repository.NewPartialRepository(pool)
	bolaoRepo := repository.NewBolaoRepository(pool)

	classificationSvc := service.NewClassificationService(bolaoRepo, matchRepo, predictionRepo, partialRepo)
	exportSvc := service.NewExportService(bolaoRepo, matchRepo, predictionRepo)
	bolaoSvc := service.NewBolaoService(bolaoRepo, matchRepo)

	authHandler := handler.NewAuthHandler(userRepo, cfg.JWTSecret)
	userHandler := handler.NewUserHandler(userRepo, bolaoRepo)
	matchHandler := handler.NewMatchHandler(matchRepo, bolaoRepo)
	predictionHandler := handler.NewPredictionHandler(predictionRepo, matchRepo, bolaoRepo)
	partialHandler := handler.NewPartialHandler(matchRepo, partialRepo, bolaoRepo)
	classificationHandler := handler.NewClassificationHandler(classificationSvc, bolaoRepo)
	exportHandler := handler.NewExportHandler(exportSvc, bolaoRepo)
	bolaoHandler := handler.NewBolaoHandler(bolaoSvc, bolaoRepo)

	r := gin.Default()

	r.Use(corsMiddleware())

	r.POST("/api/auth/login", authHandler.Login)
	r.GET("/api/teams", userHandler.GetTeams)

	api := r.Group("/api")
	api.Use(handler.AuthMiddleware(cfg.JWTSecret))
	{
		api.POST("/auth/change-password", authHandler.ChangePassword)
		api.GET("/classification", classificationHandler.Get)
		api.GET("/matches/rounds", matchHandler.ListRounds)
		api.GET("/matches/round/:round", matchHandler.ListByRound)
		api.GET("/users", userHandler.List)
		api.GET("/predictions", predictionHandler.GetMyPredictions)
		api.GET("/predictions/round/:round/user/:user_id", predictionHandler.GetByUserAndRound)
		api.POST("/predictions", predictionHandler.UpsertPredictions)
		api.GET("/me", userHandler.GetMe)
		api.PUT("/me", userHandler.UpdateMe)
		api.GET("/parciais/round/:round", partialHandler.ListByRound)
		api.PUT("/parciais/match/:id", partialHandler.SetPartial)
		api.DELETE("/parciais/match/:id", partialHandler.ClearPartial)
		api.GET("/parciais/round/:round/classification", classificationHandler.GetByPartials)
		api.GET("/export/round/:round", exportHandler.ExportRound)
		api.GET("/export/all", exportHandler.ExportAll)
		api.GET("/boloes", bolaoHandler.List)
		api.GET("/boloes/active", bolaoHandler.GetActive)
		api.GET("/boloes/:id/participants", bolaoHandler.ListParticipants)

		admin := api.Group("")
		admin.Use(handler.AdminMiddleware())
		{
			admin.POST("/users", userHandler.Create)
			admin.PUT("/users/:id", userHandler.Update)
			admin.POST("/matches", matchHandler.CreateMatches)
			admin.PUT("/matches/:id", matchHandler.UpdateMatch)
			admin.PUT("/matches/:id/results", matchHandler.UpdateResults)
			admin.DELETE("/matches/:id", matchHandler.DeleteMatch)
			admin.PUT("/matches/round/:round/closes", matchHandler.UpdateRoundCloses)
			admin.DELETE("/matches/round/:round", matchHandler.DeleteRound)
			admin.POST("/boloes", bolaoHandler.Create)
			admin.POST("/boloes/active/finish", bolaoHandler.FinishActive)
			admin.PUT("/boloes/:id/participants/:user_id", bolaoHandler.UpdateParticipantAmountPaid)
		}
	}

	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

func runMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	for _, name := range []string{"001_init.sql", "002_timestamptz.sql", "003_match_partials.sql", "004_passwords.sql", "005_partials_nullable.sql", "006_boloes.sql"} {
		path := filepath.Join("migrations", name)
		content, err := os.ReadFile(path)
		if err != nil {
			path = filepath.Join("..", "migrations", name)
			content, err = os.ReadFile(path)
		}
		if err != nil {
			if name != "001_init.sql" {
				log.Printf("migration %s: read failed (continuing): %v", name, err)
				continue
			}
			return err
		}
		if _, err = pool.Exec(ctx, string(content)); err != nil {
			if name != "001_init.sql" {
				log.Printf("migration %s: exec failed (continuing): %v", name, err)
				continue
			}
			return err
		}
	}
	return nil
}
