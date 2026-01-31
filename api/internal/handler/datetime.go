package handler

import (
	"fmt"
	"strings"
	"time"
)

// FlexibleTime aceita RFC3339/ISO8601 com timezone. Armazena sempre em UTC.
type FlexibleTime struct {
	Time *time.Time
}

func (ft *FlexibleTime) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), `"`)
	if s == "" || s == "null" {
		ft.Time = nil
		return nil
	}
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		t, err = time.Parse("2006-01-02T15:04:05Z07:00", s)
	}
	if err != nil {
		return fmt.Errorf("formato de data inválido: %s", s)
	}
	ft.Time = &t
	return nil
}

func (ft FlexibleTime) MarshalJSON() ([]byte, error) {
	if ft.Time == nil {
		return []byte("null"), nil
	}
	return []byte(`"` + ft.Time.Format(time.RFC3339) + `"`), nil
}
