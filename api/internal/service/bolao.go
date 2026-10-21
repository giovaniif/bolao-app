package service

import (
	"context"
	"errors"
	"fmt"
	"slices"

	"github.com/bolao-app/api/internal/models"
	"github.com/bolao-app/api/internal/repository"
	"github.com/google/uuid"
)

var ErrNoActiveBolao = errors.New("nenhum bolão ativo encontrado")
var ErrBolaoNotFound = errors.New("bolão não encontrado")
var ErrActiveBolaoExists = repository.ErrActiveBolaoExists

type ErrUnresolvedMatches struct {
	Rounds []int
	Count  int
}

func (e *ErrUnresolvedMatches) Error() string {
	return fmt.Sprintf("%d jogo(s) sem resultado definido", e.Count)
}

type BolaoStore interface {
	GetActive(ctx context.Context) (*models.Bolao, error)
	GetByID(ctx context.Context, id uuid.UUID) (*models.Bolao, error)
	Finish(ctx context.Context, id uuid.UUID) error
	Create(ctx context.Context, name string) (*models.Bolao, error)
	EnrollAllUsers(ctx context.Context, bolaoID uuid.UUID) error
}

type BolaoMatchLister interface {
	ListAllByBolao(ctx context.Context, bolaoID uuid.UUID) ([]models.Match, error)
}

type BolaoService struct {
	bolaoRepo BolaoStore
	matchRepo BolaoMatchLister
}

func NewBolaoService(bolaoRepo BolaoStore, matchRepo BolaoMatchLister) *BolaoService {
	return &BolaoService{bolaoRepo: bolaoRepo, matchRepo: matchRepo}
}

func (s *BolaoService) GetActiveOrErr(ctx context.Context) (*models.Bolao, error) {
	active, err := s.bolaoRepo.GetActive(ctx)
	if err != nil {
		return nil, ErrNoActiveBolao
	}
	return active, nil
}

func (s *BolaoService) FinishActive(ctx context.Context, force bool) (*models.Bolao, error) {
	active, err := s.GetActiveOrErr(ctx)
	if err != nil {
		return nil, err
	}
	return s.Finish(ctx, active.ID, force)
}

func (s *BolaoService) Finish(ctx context.Context, bolaoID uuid.UUID, force bool) (*models.Bolao, error) {
	bolao, err := s.bolaoRepo.GetByID(ctx, bolaoID)
	if err != nil {
		return nil, ErrBolaoNotFound
	}
	if bolao.Status != "active" {
		return nil, ErrBolaoFinished
	}

	if !force {
		matches, err := s.matchRepo.ListAllByBolao(ctx, bolaoID)
		if err != nil {
			return nil, err
		}
		if unresolved := UnresolvedMatches(matches); unresolved != nil {
			return nil, unresolved
		}
	}

	if err := s.bolaoRepo.Finish(ctx, bolaoID); err != nil {
		return nil, err
	}
	return s.bolaoRepo.GetByID(ctx, bolaoID)
}

func UnresolvedMatches(matches []models.Match) *ErrUnresolvedMatches {
	var rounds []int
	count := 0
	for _, m := range matches {
		if m.HomeGoals != nil && m.AwayGoals != nil {
			continue
		}
		count++
		if !slices.Contains(rounds, m.Round) {
			rounds = append(rounds, m.Round)
		}
	}
	if count == 0 {
		return nil
	}
	slices.Sort(rounds)
	return &ErrUnresolvedMatches{Rounds: rounds, Count: count}
}

func (s *BolaoService) CreateNew(ctx context.Context, name string) (*models.Bolao, error) {
	if _, err := s.bolaoRepo.GetActive(ctx); err == nil {
		return nil, ErrActiveBolaoExists
	}

	bolao, err := s.bolaoRepo.Create(ctx, name)
	if err != nil {
		return nil, err
	}

	if err := s.bolaoRepo.EnrollAllUsers(ctx, bolao.ID); err != nil {
		return nil, err
	}

	return bolao, nil
}
