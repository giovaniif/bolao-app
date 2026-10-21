package push

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/bolao-app/api/internal/models"
)

const (
	ExpoPushURL   = "https://exp.host/--/api/v2/push/send"
	expoBatchSize = 100
)

type ExpoSender struct {
	url         string
	accessToken string
	client      *http.Client
}

func NewExpoSender(url, accessToken string, client *http.Client) *ExpoSender {
	return &ExpoSender{url: url, accessToken: accessToken, client: client}
}

type expoTicket struct {
	Status  string `json:"status"`
	Details struct {
		Error string `json:"error"`
	} `json:"details"`
}

func (s *ExpoSender) Send(ctx context.Context, msgs []models.ExpoMessage) ([]models.ExpoResult, error) {
	results := make([]models.ExpoResult, 0, len(msgs))
	for start := 0; start < len(msgs); start += expoBatchSize {
		end := min(start+expoBatchSize, len(msgs))
		batch, err := s.sendBatch(ctx, msgs[start:end])
		if err != nil {
			return results, err
		}
		results = append(results, batch...)
	}
	return results, nil
}

func (s *ExpoSender) sendBatch(ctx context.Context, msgs []models.ExpoMessage) ([]models.ExpoResult, error) {
	body, err := json.Marshal(msgs)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if s.accessToken != "" {
		req.Header.Set("Authorization", "Bearer "+s.accessToken)
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("expo push: status %d", resp.StatusCode)
	}
	var out struct {
		Data []expoTicket `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	results := make([]models.ExpoResult, len(msgs))
	for i, m := range msgs {
		results[i].Token = m.To
		if i >= len(out.Data) {
			continue
		}
		results[i].OK = out.Data[i].Status == "ok"
		results[i].DeviceNotRegistered = out.Data[i].Details.Error == "DeviceNotRegistered"
	}
	return results, nil
}
