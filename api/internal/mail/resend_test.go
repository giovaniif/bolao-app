package mail

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestResendSender_PostsTheEmailWithTheKey(t *testing.T) {
	var got map[string]any
	var authorization string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authorization = r.Header.Get("Authorization")
		if r.Method != http.MethodPost || r.URL.Path != "/emails" {
			t.Errorf("request = %s %s, want POST /emails", r.Method, r.URL.Path)
		}
		_ = json.NewDecoder(r.Body).Decode(&got)
		_, _ = w.Write([]byte(`{"id":"1"}`))
	}))
	defer srv.Close()

	s := NewResendSender(srv.URL, "re_key", "Bolão <a@b.c>")
	if err := s.Send(context.Background(), "maria@example.com", "Assunto", "<p>oi</p>", "oi"); err != nil {
		t.Fatalf("Send: %v", err)
	}
	if authorization != "Bearer re_key" {
		t.Errorf("Authorization = %q, want Bearer re_key", authorization)
	}
	to, _ := got["to"].([]any)
	if got["from"] != "Bolão <a@b.c>" || len(to) != 1 || to[0] != "maria@example.com" || got["subject"] != "Assunto" || got["html"] != "<p>oi</p>" || got["text"] != "oi" {
		t.Errorf("body = %v, want from, to, subject, html and text", got)
	}
}

func TestResendSender_AnErrorStatusIsAnError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnprocessableEntity)
	}))
	defer srv.Close()
	if err := NewResendSender(srv.URL, "k", "f").Send(context.Background(), "a@b.c", "s", "h", "t"); err == nil {
		t.Error("err = nil, want an error for status 422")
	}
}
