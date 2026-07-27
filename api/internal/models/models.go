package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID                 uuid.UUID `json:"id"`
	Username           string    `json:"username"`
	DisplayName        string    `json:"display_name"`
	FavoriteTeam       *string   `json:"favorite_team,omitempty"`
	IsAdmin            bool      `json:"is_admin"`
	PasswordHash       string    `json:"-"`
	MustChangePassword bool      `json:"must_change_password,omitempty"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

type Match struct {
	ID             uuid.UUID  `json:"id"`
	BolaoID        uuid.UUID  `json:"bolao_id"`
	Round          int        `json:"round"`
	HomeTeam       string     `json:"home_team"`
	AwayTeam       string     `json:"away_team"`
	MarketClosesAt *time.Time `json:"market_closes_at,omitempty"`
	HomeGoals      *int       `json:"home_goals,omitempty"`
	AwayGoals      *int       `json:"away_goals,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type Bolao struct {
	ID         uuid.UUID  `json:"id"`
	Name       string     `json:"name"`
	Status     string     `json:"status"`
	StartedAt  time.Time  `json:"started_at"`
	FinishedAt *time.Time `json:"finished_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

type BolaoParticipant struct {
	BolaoID    uuid.UUID `json:"bolao_id"`
	UserID     uuid.UUID `json:"user_id"`
	AmountPaid float64   `json:"amount_paid"`
	JoinedAt   time.Time `json:"joined_at"`
}

// ParticipantView is a user joined with their participation record for a specific bolão.
type ParticipantView struct {
	User
	AmountPaid float64   `json:"amount_paid"`
	JoinedAt   time.Time `json:"joined_at"`
}

type Prediction struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	MatchID   uuid.UUID `json:"match_id"`
	HomeGoals int       `json:"home_goals"`
	AwayGoals int       `json:"away_goals"`
	// AutoFilled marca um palpite 0×0 sintetizado em tempo de leitura para quem não
	// preencheu um jogo cujo mercado já fechou. Não existe linha no banco para ele.
	AutoFilled bool      `json:"auto_filled,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type MatchPartial struct {
	MatchID   uuid.UUID  `json:"match_id"`
	HomeGoals *int       `json:"home_goals,omitempty"`
	AwayGoals *int       `json:"away_goals,omitempty"`
	UpdatedBy *uuid.UUID `json:"updated_by,omitempty"`
	UpdatedAt time.Time  `json:"updated_at"`
}

type UserWithStats struct {
	User
	AmountPaid     float64 `json:"amount_paid"`
	TotalPoints    int     `json:"total_points"`
	ExactScores    int     `json:"exact_scores"`
	CorrectResults int     `json:"correct_results"`
	RoundsWon      int     `json:"rounds_won"`
}
