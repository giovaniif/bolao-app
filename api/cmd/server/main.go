package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/bolao-app/api/internal/auth"
	"github.com/bolao-app/api/internal/config"
	"github.com/bolao-app/api/internal/database"
	"github.com/bolao-app/api/internal/footballdata"
	"github.com/bolao-app/api/internal/handler"
	"github.com/bolao-app/api/internal/mail"
	"github.com/bolao-app/api/internal/observability"
	"github.com/bolao-app/api/internal/push"
	"github.com/bolao-app/api/internal/repository"
	"github.com/bolao-app/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

const expoTimeout = 15 * time.Second

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
	bolaoSvc := service.NewBolaoService(bolaoRepo, matchRepo)
	var webSender service.PushSender
	if cfg.VAPIDPublicKey != "" && cfg.VAPIDPrivateKey != "" && cfg.VAPIDSubject != "" {
		webSender = push.NewWebPushSender(cfg.VAPIDPublicKey, cfg.VAPIDPrivateKey, cfg.VAPIDSubject)
	} else {
		log.Print("web push disabled: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY or VAPID_SUBJECT not set")
	}
	expoSender := push.NewExpoSender(push.ExpoPushURL, cfg.ExpoAccessToken, &http.Client{Timeout: expoTimeout})
	notificationSvc := service.NewNotificationService(pushRepo, webSender, expoSender)

	var matchSyncer handler.MatchSyncer
	if cfg.FootballDataAPIKey != "" {
		feed := footballdata.NewClient(footballdata.DefaultBaseURL, cfg.FootballDataAPIKey)
		matchSyncer = service.NewMatchSyncService(feed, repository.NewMatchSyncRepository(pool), time.Now)
	} else {
		log.Print("match sync disabled: FOOTBALL_DATA_API_KEY not set")
	}

	var mailer service.Mailer
	if cfg.ResendAPIKey != "" {
		mailer = mail.NewResendSender(mail.ResendBaseURL, cfg.ResendAPIKey, cfg.ResendFrom)
	} else {
		log.Print("password reset emails disabled: RESEND_API_KEY not set")
	}
	passwordResetSvc := service.NewPasswordResetService(repository.NewPasswordResetRepository(pool), mailer, cfg.AppURL, time.Now, service.RandomResetToken)

	authHandler := handler.NewAuthHandler(userRepo, cfg.JWTSecret)
	socialAuthHandler := handler.NewSocialAuthHandler(repository.NewIdentityRepository(pool), socialVerifiers(cfg), cfg.JWTSecret)
	passwordResetHandler := handler.NewPasswordResetHandler(passwordResetSvc)
	userHandler := handler.NewUserHandler(userRepo, bolaoRepo)
	pushHandler := handler.NewPushHandler(pushRepo, bolaoRepo, matchRepo, notificationSvc, matchSyncer, cfg.VAPIDPublicKey, cfg.CronSecret)
	matchHandler := handler.NewMatchHandler(matchRepo, bolaoRepo, pushHandler)
	predictionHandler := handler.NewPredictionHandler(predictionRepo, matchRepo, bolaoRepo)
	partialHandler := handler.NewPartialHandler(matchRepo, partialRepo, bolaoRepo)
	classificationHandler := handler.NewClassificationHandler(classificationSvc, bolaoRepo)
	bolaoHandler := handler.NewBolaoHandler(bolaoSvc, bolaoRepo)

	flushSentry, err := observability.Init(cfg.SentryDSN, cfg.SentryEnvironment, cfg.Release)
	if err != nil {
		log.Printf("sentry disabled: %v", err)
	}
	defer flushSentry()

	r := gin.Default()
	r.Use(observability.Middleware(cfg.SentryDSN))

	r.Use(corsMiddleware())

	r.POST("/api/auth/login", authHandler.Login)
	r.POST("/api/auth/signup", authHandler.Signup)
	r.POST("/api/auth/forgot-password", passwordResetHandler.Forgot)
	r.POST("/api/auth/reset-password", passwordResetHandler.Reset)
	r.POST("/api/auth/social", socialAuthHandler.Login)
	r.GET("/api/teams", userHandler.GetTeams)
	r.GET("/api/rules", handler.GetRules)
	r.GET("/api/competitions", handler.NewCompetitionHandler(repository.NewCompetitionRepository(pool)).List)
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
		api.POST("/predictions", handler.RequireDefaultMembership(bolaoRepo, membershipRepo), predictionHandler.UpsertPredictions)
		api.GET("/me", userHandler.GetMe)
		api.POST("/push/subscriptions", pushHandler.Subscribe)
		api.DELETE("/push/subscriptions", pushHandler.Unsubscribe)
		api.POST("/push/expo-tokens", pushHandler.RegisterExpoToken)
		api.DELETE("/push/expo-tokens", pushHandler.UnregisterExpoToken)
		api.PUT("/me", userHandler.UpdateMe)
		api.DELETE("/me", userHandler.DeleteMe)
		api.GET("/parciais/round/:round", partialHandler.ListByRound)
		api.PUT("/parciais/match/:id", partialHandler.SetPartial)
		api.DELETE("/parciais/match/:id", partialHandler.ClearPartial)
		api.GET("/parciais/round/:round/classification", classificationHandler.GetByPartials)
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
		}

		handler.NewMemberHandler(membershipRepo, bolaoRepo).Routes(api, handler.RequireMember(membershipRepo))
		inviteHandler.Routes(api, handler.RequireMember(membershipRepo))

		admin := api.Group("")
		admin.Use(handler.AdminMiddleware())
		handler.NewPublicBolaoHandler(membershipRepo, bolaoRepo).Routes(api, admin)
		matchHandler.AdminRoutes(admin, handler.RequireMember(membershipRepo))
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
	for _, name := range []string{"001_init.sql", "002_timestamptz.sql", "003_match_partials.sql", "004_passwords.sql", "005_partials_nullable.sql", "006_boloes.sql", "007_push_notifications.sql", "008_competitions.sql", "009_match_sync.sql", "010_bolao_members.sql", "011_many_active_boloes.sql", "012_hidden_boloes.sql", "013_bolao_first_round.sql", "014_password_reset.sql", "015_expo_push_tokens.sql", "016_user_identities.sql"} {
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

func socialVerifiers(cfg *config.Config) map[string]handler.IDTokenVerifier {
	verifiers := map[string]handler.IDTokenVerifier{}
	if len(cfg.AppleClientIDs) > 0 {
		verifiers["apple"] = auth.NewIDTokenVerifier(auth.AppleJWKSURL, auth.AppleIssuers, cfg.AppleClientIDs, nil)
	}
	if len(cfg.GoogleClientIDs) > 0 {
		verifiers["google"] = auth.NewIDTokenVerifier(auth.GoogleJWKSURL, auth.GoogleIssuers, cfg.GoogleClientIDs, nil)
	}
	return verifiers
}
