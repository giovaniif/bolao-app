package service

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

type fakeFinishBoloes struct {
	boloes   map[uuid.UUID]*models.Bolao
	finished []uuid.UUID
}

func (f *fakeFinishBoloes) GetActive(context.Context) (*models.Bolao, error) {
	for _, b := range f.boloes {
		if b.Status == "active" {
			return b, nil
		}
	}
	return nil, errors.New("no rows")
}

func (f *fakeFinishBoloes) GetByID(_ context.Context, id uuid.UUID) (*models.Bolao, error) {
	if b, ok := f.boloes[id]; ok {
		return b, nil
	}
	return nil, errors.New("no rows")
}

func (f *fakeFinishBoloes) Finish(_ context.Context, id uuid.UUID) error {
	f.finished = append(f.finished, id)
	f.boloes[id].Status = "finished"
	return nil
}

func (f *fakeFinishBoloes) Create(context.Context, string) (*models.Bolao, error) {
	return nil, errors.New("not used")
}

func (f *fakeFinishBoloes) EnrollAllUsers(context.Context, uuid.UUID) error { return nil }

type fakeFinishMatches map[uuid.UUID][]models.Match

func (f fakeFinishMatches) ListAllByBolao(_ context.Context, bolaoID uuid.UUID) ([]models.Match, error) {
	return f[bolaoID], nil
}

func finishFixture() (*fakeFinishBoloes, fakeFinishMatches, uuid.UUID, uuid.UUID) {
	first, second := uuid.New(), uuid.New()
	boloes := &fakeFinishBoloes{boloes: map[uuid.UUID]*models.Bolao{
		first:  {ID: first, Status: "active"},
		second: {ID: second, Status: "active"},
	}}
	matches := fakeFinishMatches{
		first: {{Round: 1, HomeGoals: goals(1), AwayGoals: goals(0)}},
		second: {
			{Round: 1, HomeGoals: goals(2), AwayGoals: goals(2)},
			{Round: 2},
			{Round: 3, HomeGoals: goals(1)},
			{Round: 3},
		},
	}
	return boloes, matches, first, second
}

func TestFinishFinishesTheGivenBolaoNotTheDefaultActive(t *testing.T) {
	boloes, matches, first, second := finishFixture()
	matches[second] = matches[first]
	svc := NewBolaoService(boloes, matches)

	got, err := svc.Finish(context.Background(), second, false)
	if err != nil {
		t.Fatal(err)
	}
	if got.ID != second || got.Status != "finished" {
		t.Errorf("got %+v, want bolão %s finished", got, second)
	}
	if !reflect.DeepEqual(boloes.finished, []uuid.UUID{second}) {
		t.Errorf("finished = %v, want only %s", boloes.finished, second)
	}
}

func TestFinishRefusesUnresolvedMatchesWithoutForce(t *testing.T) {
	boloes, matches, _, second := finishFixture()
	svc := NewBolaoService(boloes, matches)

	_, err := svc.Finish(context.Background(), second, false)
	var unresolved *ErrUnresolvedMatches
	if !errors.As(err, &unresolved) {
		t.Fatalf("err = %v, want ErrUnresolvedMatches", err)
	}
	if unresolved.Count != 3 || !reflect.DeepEqual(unresolved.Rounds, []int{2, 3}) {
		t.Errorf("got %+v, want 3 matches in rounds [2 3]", unresolved)
	}
	if len(boloes.finished) != 0 {
		t.Errorf("finished = %v, want none", boloes.finished)
	}
}

func TestFinishWithForceIgnoresUnresolvedMatches(t *testing.T) {
	boloes, matches, _, second := finishFixture()
	svc := NewBolaoService(boloes, matches)

	if _, err := svc.Finish(context.Background(), second, true); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(boloes.finished, []uuid.UUID{second}) {
		t.Errorf("finished = %v, want %s", boloes.finished, second)
	}
}

func TestFinishRefusesAFinishedBolao(t *testing.T) {
	boloes, matches, first, _ := finishFixture()
	boloes.boloes[first].Status = "finished"
	svc := NewBolaoService(boloes, matches)

	if _, err := svc.Finish(context.Background(), first, true); !errors.Is(err, ErrBolaoFinished) {
		t.Errorf("err = %v, want ErrBolaoFinished", err)
	}
	if len(boloes.finished) != 0 {
		t.Errorf("finished = %v, want none", boloes.finished)
	}
}

func TestFinishOfAnUnknownBolaoIsNotFound(t *testing.T) {
	boloes, matches, _, _ := finishFixture()
	svc := NewBolaoService(boloes, matches)

	if _, err := svc.Finish(context.Background(), uuid.New(), true); !errors.Is(err, ErrBolaoNotFound) {
		t.Errorf("err = %v, want ErrBolaoNotFound", err)
	}
}
