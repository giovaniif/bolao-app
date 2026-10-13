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
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
