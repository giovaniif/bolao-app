package mail

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const ResendBaseURL = "https://api.resend.com"

type ResendSender struct {
	baseURL string
	apiKey  string
	from    string
	client  *http.Client
}

func NewResendSender(baseURL, apiKey, from string) *ResendSender {
	return &ResendSender{baseURL: strings.TrimRight(baseURL, "/"), apiKey: apiKey, from: from, client: &http.Client{Timeout: 10 * time.Second}}
}

type resendEmail struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
	Text    string   `json:"text"`
}

func (s *ResendSender) Send(ctx context.Context, to, subject, html, text string) error {
	body, err := json.Marshal(resendEmail{From: s.from, To: []string{to}, Subject: subject, HTML: html, Text: text})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.baseURL+"/emails", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("resend: status %d", resp.StatusCode)
	}
	return nil
}
