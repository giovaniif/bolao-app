package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"regexp"
	"strconv"
	"strings"

	"github.com/bolao-app/api/internal/config"
	"github.com/bolao-app/api/internal/database"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// IDs das partidas da rodada 1, na ordem do palpites.md (Vitória x Remo, Atlético-MG x Palmeiras, ...)
var round1MatchIDs = []uuid.UUID{
	uuid.MustParse("4048c80d-18c3-4ab4-b3dc-f952f35e6818"),
	uuid.MustParse("9caf85d9-f07d-4255-9e70-35e901dfb2cf"),
	uuid.MustParse("ad9298f0-00aa-4452-a56c-76d8fb74ddce"),
	uuid.MustParse("0fb61efb-5d38-4294-a740-4f2b657e8e4a"),
	uuid.MustParse("1cb42bf0-e259-4772-a70f-d4bd464f235e"),
	uuid.MustParse("9732ace4-f43d-4cfb-a6e5-8da40b575252"),
	uuid.MustParse("97ea38c8-9fef-4008-83e3-4d76c8e094e1"),
	uuid.MustParse("33828232-042c-48b4-9388-997b8f07caee"),
	uuid.MustParse("781deca9-87b5-422f-adb2-154f7b7904f3"),
	uuid.MustParse("d3fbf8a4-f814-4cb7-a6a7-1b77dc0fbad2"),
}

func main() {
	if len(os.Args) < 2 {
		log.Fatal("Uso: go run ./cmd/seed-palpites <caminho/palpites.md>")
	}
	filePath := os.Args[1]
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		log.Fatalf("Arquivo não encontrado: %s", filePath)
	}

	cfg := config.Load()
	ctx := context.Background()

	pool, err := database.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()

	userPredictions, err := parsePalpitesFile(filePath)
	if err != nil {
		log.Fatalf("parse: %v", err)
	}

	if err := seedPredictions(ctx, pool, userPredictions); err != nil {
		log.Fatalf("seed: %v", err)
	}

	log.Printf("Inseridos palpites da rodada 1 para %d usuários.", len(userPredictions))
}

var scoreRe = regexp.MustCompile(`^\d+x\d+$`)

func parsePalpitesFile(path string) (map[string][]string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	lines := strings.Split(string(data), "\n")
	userPreds := make(map[string][]string)
	var currentUser string
	var preds []string

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		if strings.HasPrefix(strings.ToLower(line), "ordem dos jogos") {
			continue
		}

		// Formato "Mandante x Visitante" (apenas para pular, ordem vem dos IDs)
		if strings.Contains(line, " x ") {
			continue
		}

		// Formato "HxA" (ex: 1x2, 0x0)
		if scoreRe.MatchString(line) {
			if currentUser != "" {
				preds = append(preds, line)
			}
			continue
		}

		// Nome de usuário
		if currentUser != "" && len(preds) > 0 {
			userPreds[currentUser] = preds
			preds = nil
		}
		currentUser = strings.ToLower(strings.TrimSpace(line))
	}
	if currentUser != "" && len(preds) > 0 {
		userPreds[currentUser] = preds
	}

	return userPreds, nil
}

func parseScore(s string) (home, away int, err error) {
	parts := strings.Split(s, "x")
	if len(parts) != 2 {
		return 0, 0, fmt.Errorf("formato inválido: %s", s)
	}
	home, err = strconv.Atoi(strings.TrimSpace(parts[0]))
	if err != nil {
		return 0, 0, err
	}
	away, err = strconv.Atoi(strings.TrimSpace(parts[1]))
	if err != nil {
		return 0, 0, err
	}
	return home, away, nil
}

func seedPredictions(ctx context.Context, pool *pgxpool.Pool, userPredictions map[string][]string) error {
	matchIDs := round1MatchIDs

	// Buscar user_id por username
	userIDs := make(map[string]uuid.UUID)
	for username := range userPredictions {
		var id uuid.UUID
		err := pool.QueryRow(ctx, `SELECT id FROM users WHERE LOWER(username) = LOWER($1)`, username).Scan(&id)
		if err != nil {
			return fmt.Errorf("usuário não encontrado: %s", username)
		}
		userIDs[username] = id
	}

	// Inserir palpites
	insertQuery := `
		INSERT INTO predictions (id, user_id, match_id, home_goals, away_goals)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, match_id) DO UPDATE SET home_goals = $4, away_goals = $5, updated_at = CURRENT_TIMESTAMP`

	for username, preds := range userPredictions {
		if len(preds) != len(matchIDs) {
			log.Printf("aviso: %s tem %d palpites, esperado %d - ignorando", username, len(preds), len(matchIDs))
			continue
		}
		userID := userIDs[username]
		for i, predStr := range preds {
			home, away, err := parseScore(predStr)
			if err != nil {
				return fmt.Errorf("usuário %s, jogo %d: %w", username, i+1, err)
			}
			_, err = pool.Exec(ctx, insertQuery, uuid.New(), userID, matchIDs[i], home, away)
			if err != nil {
				return fmt.Errorf("insert %s jogo %d: %w", username, i+1, err)
			}
		}
	}

	return nil
}
