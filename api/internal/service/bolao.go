package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/bolao-app/api/internal/models"
	"github.com/bolao-app/api/internal/repository"
)

var ErrNoActiveBolao = errors.New("nenhum bolão ativo encontrado")
var ErrActiveBolaoExists = repository.ErrActiveBolaoExists

// ErrUnresolvedMatches is returned by FinishActive when matches without a final
// result exist and force wasn't requested.
type ErrUnresolvedMatches struct {
	Rounds []int
	Count  int
}

func (e *ErrUnresolvedMatches) Error() string {
	return fmt.Sprintf("%d jogo(s) sem resultado definido", e.Count)
}

type BolaoService struct {
	bolaoRepo *repository.BolaoRepository
	matchRepo *repository.MatchRepository
}

func NewBolaoService(bolaoRepo *repository.BolaoRepository, matchRepo *repository.MatchRepository) *BolaoService {
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

	if !force {
		rounds, err := s.matchRepo.ListRounds(ctx, active.ID)
		if err != nil {
			return nil, err
		}
		var unresolvedRounds []int
		unresolvedCount := 0
		for _, round := range rounds {
			matches, err := s.matchRepo.ListByRound(ctx, active.ID, round)
			if err != nil {
				return nil, err
			}
			roundHasUnresolved := false
			for _, m := range matches {
				if m.HomeGoals == nil || m.AwayGoals == nil {
					roundHasUnresolved = true
					unresolvedCount++
				}
			}
			if roundHasUnresolved {
				unresolvedRounds = append(unresolvedRounds, round)
			}
		}
		if unresolvedCount > 0 {
			return nil, &ErrUnresolvedMatches{Rounds: unresolvedRounds, Count: unresolvedCount}
		}
	}

	if err := s.bolaoRepo.Finish(ctx, active.ID); err != nil {
		return nil, err
	}
	return s.bolaoRepo.GetByID(ctx, active.ID)
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
