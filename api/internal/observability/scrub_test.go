package observability

import (
	"strings"
	"testing"

	"github.com/getsentry/sentry-go"
)

func TestScrub_RemovesSecretsAndPersonalData(t *testing.T) {
	event := &sentry.Event{
		Request: &sentry.Request{
			URL:     "https://api.example/api/auth/login",
			Headers: map[string]string{"Authorization": "Bearer jwt", "X-Cron-Secret": "s3cr3t", "Content-Type": "application/json"},
			Cookies: "session=abc",
			Data:    `{"username":"ana","password":"123"}`,
		},
		User:    sentry.User{ID: "u-1", Email: "ana@example.com", Username: "ana", IPAddress: "1.2.3.4"},
		Message: "falha para ana@example.com",
	}

	got := Scrub(event)

	if got.Request.Headers["Authorization"] != "" || got.Request.Headers["X-Cron-Secret"] != "" {
		t.Errorf("headers = %v, want no Authorization or X-Cron-Secret", got.Request.Headers)
	}
	if got.Request.Headers["Content-Type"] != "application/json" {
		t.Errorf("Content-Type = %q, want it kept", got.Request.Headers["Content-Type"])
	}
	if got.Request.Cookies != "" || got.Request.Data != "" {
		t.Errorf("cookies = %q data = %q, want both removed", got.Request.Cookies, got.Request.Data)
	}
	if got.User.Email != "" || got.User.Username != "" || got.User.IPAddress != "" || got.User.ID != "u-1" {
		t.Errorf("user = %+v, want only the id", got.User)
	}
	if strings.Contains(got.Message, "@") {
		t.Errorf("message = %q, want the email removed", got.Message)
	}
}

func TestConfigured(t *testing.T) {
	dsn := "https://key@o1.ingest.sentry.io/1"
	cases := []struct {
		dsn, environment string
		want             bool
	}{
		{"", "prod", false},
		{dsn, "", false},
		{dsn, "local", false},
		{dsn, "test", false},
		{dsn, "dev", true},
		{dsn, "prod", true},
		{dsn, "production", true},
	}
	for _, c := range cases {
		if got := Configured(c.dsn, c.environment); got != c.want {
			t.Errorf("Configured(%q, %q) = %v, want %v", c.dsn, c.environment, got, c.want)
		}
	}
}

func TestEnabled_IsOffInsideGoTest(t *testing.T) {
	if Enabled("https://key@o1.ingest.sentry.io/1", "prod") {
		t.Error("Enabled under go test = true, want false: tests must never report to Sentry")
	}
}

func TestScrub_HidesBearerTokensAndJWTsInText(t *testing.T) {
	jwt := "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoiMSJ9.c2lnbmF0dXJl"
	event := &sentry.Event{
		Message:   "call failed with Bearer abc.def-123",
		Exception: []sentry.Exception{{Value: "bad token " + jwt}},
	}
	got := Scrub(event)
	if got.Message != "call failed with Bearer [token]" {
		t.Errorf("message = %q", got.Message)
	}
	if got.Exception[0].Value != "bad token [token]" {
		t.Errorf("exception = %q", got.Exception[0].Value)
	}
}
