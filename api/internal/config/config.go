package config

import (
	"os"
)

type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string

	VAPIDPublicKey  string
	VAPIDPrivateKey string
	VAPIDSubject    string
	CronSecret      string

	ExpoAccessToken string

	FootballDataAPIKey string

	AppURL       string
	ResendAPIKey string
	ResendFrom   string

	SentryDSN         string
	SentryEnvironment string
	Release           string
}

func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "3333"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/bolao?sslmode=disable"),
		JWTSecret:   getEnv("JWT_SECRET", "bolao-secret-change-in-production"),

		VAPIDPublicKey:  os.Getenv("VAPID_PUBLIC_KEY"),
		VAPIDPrivateKey: os.Getenv("VAPID_PRIVATE_KEY"),
		VAPIDSubject:    os.Getenv("VAPID_SUBJECT"),
		CronSecret:      os.Getenv("CRON_SECRET"),

		ExpoAccessToken: os.Getenv("EXPO_ACCESS_TOKEN"),

		FootballDataAPIKey: os.Getenv("FOOTBALL_DATA_API_KEY"),

		AppURL:       getEnv("APP_URL", "https://bolao.giovani.app"),
		ResendAPIKey: os.Getenv("RESEND_API_KEY"),
		ResendFrom:   getEnv("RESEND_FROM", "Bolão <nao-responda@bolao.giovani.app>"),

		SentryDSN:         os.Getenv("SENTRY_DSN"),
		SentryEnvironment: getEnv("SENTRY_ENVIRONMENT", "dev"),
		Release:           os.Getenv("RENDER_GIT_COMMIT"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
