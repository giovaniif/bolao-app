package main

import (
	"context"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/bolao-app/api/internal/config"
	"github.com/bolao-app/api/internal/database"
	"github.com/bolao-app/api/internal/footballdata"
	"github.com/bolao-app/api/internal/handler"
	"github.com/bolao-app/api/internal/push"
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
	pushRepo := repository.NewPushRepository(pool)
	membershipRepo := repository.NewMembershipRepository(pool)

	classificationSvc := service.NewClassificationService(bolaoRepo, matchRepo, predictionRepo, partialRepo)
	exportSvc := service.NewExportService(bolaoRepo, matchRepo, predictionRepo)
	bolaoSvc := service.NewBolaoService(bolaoRepo, matchRepo)
	var notificationSvc *service.NotificationService
	if cfg.VAPIDPublicKey != "" && cfg.VAPIDPrivateKey != "" && cfg.VAPIDSubject != "" {
		notificationSvc = service.NewNotificationService(pushRepo, push.NewWebPushSender(cfg.VAPIDPublicKey, cfg.VAPIDPrivateKey, cfg.VAPIDSubject))
	} else {
		log.Print("push notifications disabled: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY or VAPID_SUBJECT not set")
	}

	var matchSyncer handler.MatchSyncer
	if cfg.FootballDataAPIKey != "" {
		feed := footballdata.NewClient(footballdata.DefaultBaseURL, cfg.FootballDataAPIKey)
		matchSyncer = service.NewMatchSyncService(feed, repository.NewMatchSyncRepository(pool), time.Now)
	} else {
		log.Print("match sync disabled: FOOTBALL_DATA_API_KEY not set")
	}

	authHandler := handler.NewAuthHandler(userRepo, cfg.JWTSecret)
	userHandler := handler.NewUserHandler(userRepo, bolaoRepo)
	var notifier handler.RoundNotifier
	if notificationSvc != nil {
		notifier = notificationSvc
	}
	pushHandler := handler.NewPushHandler(pushRepo, bolaoRepo, matchRepo, notifier, matchSyncer, cfg.VAPIDPublicKey, cfg.CronSecret)
	matchHandler := handler.NewMatchHandler(matchRepo, bolaoRepo, pushHandler)
	predictionHandler := handler.NewPredictionHandler(predictionRepo, matchRepo, bolaoRepo)
	partialHandler := handler.NewPartialHandler(matchRepo, partialRepo, bolaoRepo)
	classificationHandler := handler.NewClassificationHandler(classificationSvc, bolaoRepo)
	exportHandler := handler.NewExportHandler(exportSvc, bolaoRepo)
	bolaoHandler := handler.NewBolaoHandler(bolaoSvc, bolaoRepo)

	r := gin.Default()

	r.Use(corsMiddleware())

	r.POST("/api/auth/login", authHandler.Login)
	r.GET("/api/teams", userHandler.GetTeams)
	r.GET("/api/push/public-key", pushHandler.PublicKey)
	r.POST("/api/internal/notifications/tick", pushHandler.Tick)

	inviteHandler := handler.NewInviteHandler(repository.NewInviteRepository(pool), membershipRepo, bolaoRepo)
	inviteHandler.PublicRoutes(r.Group("/api"))

	api := r.Group("/api")
	api.Use(handler.AuthMiddleware(cfg.JWTSecret))
	{
		api.POST("/auth/change-password", authHandler.ChangePassword)
		api.GET("/classification", classificationHandler.Get)
		api.GET("/matches/rounds", matchHandler.ListRounds)
		api.GET("/matches/rounds/summary", matchHandler.ListRoundsSummary)
		api.GET("/matches/round/:round", matchHandler.ListByRound)
		api.GET("/users", userHandler.List)
		api.GET("/predictions", predictionHandler.GetMyPredictions)
		api.GET("/predictions/round/:round/user/:user_id", predictionHandler.GetByUserAndRound)
		api.POST("/predictions", predictionHandler.UpsertPredictions)
		api.GET("/me", userHandler.GetMe)
		api.POST("/push/subscriptions", pushHandler.Subscribe)
		api.DELETE("/push/subscriptions", pushHandler.Unsubscribe)
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

		scoped := api.Group("/boloes/:id", handler.RequireMember(membershipRepo))
		{
			scoped.GET("/classification", classificationHandler.Get)
			scoped.GET("/matches/rounds", matchHandler.ListRounds)
			scoped.GET("/matches/rounds/summary", matchHandler.ListRoundsSummary)
			scoped.GET("/matches/round/:round", matchHandler.ListByRound)
			scoped.GET("/predictions", predictionHandler.GetMyPredictions)
			scoped.GET("/predictions/round/:round/user/:user_id", predictionHandler.GetByUserAndRound)
			scoped.POST("/predictions", predictionHandler.UpsertPredictions)
			scoped.GET("/parciais/round/:round", partialHandler.ListByRound)
			scoped.GET("/parciais/round/:round/classification", classificationHandler.GetByPartials)
			scoped.GET("/export/round/:round", exportHandler.ExportRound)
			scoped.GET("/export/all", exportHandler.ExportAll)
		}

		handler.NewMemberHandler(membershipRepo, bolaoRepo).Routes(api, handler.RequireMember(membershipRepo))
		inviteHandler.Routes(api, handler.RequireMember(membershipRepo))

		admin := api.Group("")
		admin.Use(handler.AdminMiddleware())
		handler.NewPublicBolaoHandler(membershipRepo, bolaoRepo).Routes(api, admin)
		{
			admin.POST("/users", userHandler.Create)
			admin.PUT("/users/:id", userHandler.Update)
			admin.POST("/matches", matchHandler.CreateMatches)
			admin.PUT("/matches/:id", matchHandler.UpdateMatch)
			admin.PUT("/matches/:id/results", matchHandler.UpdateResults)
			admin.DELETE("/matches/:id", matchHandler.DeleteMatch)
			admin.DELETE("/matches/:id/lock", matchHandler.UnlockMatch)
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
	for _, name := range []string{"001_init.sql", "002_timestamptz.sql", "003_match_partials.sql", "004_passwords.sql", "005_partials_nullable.sql", "006_boloes.sql", "007_push_notifications.sql", "008_competitions.sql", "009_match_sync.sql", "010_bolao_members.sql", "011_many_active_boloes.sql", "012_hidden_boloes.sql"} {
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
