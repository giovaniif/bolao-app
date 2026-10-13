package push

import (
	"context"
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/SherClockHolmes/webpush-go"
	"github.com/bolao-app/api/internal/models"
)

func browserSubscription(t *testing.T, endpoint string) models.PushSubscription {
	t.Helper()
	key, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	auth := make([]byte, 16)
	_, _ = rand.Read(auth)
	return models.PushSubscription{
		Endpoint: endpoint,
		P256dh:   base64.RawURLEncoding.EncodeToString(key.PublicKey().Bytes()),
		Auth:     base64.RawURLEncoding.EncodeToString(auth),
	}
}

func TestWebPushSenderSend(t *testing.T) {
	priv, pub, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		name   string
		status int
	}{
		{"delivered", http.StatusCreated},
		{"expired subscription", http.StatusGone},
	}
	for _, tt := range tests {
		var got *http.Request
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			got = r
			w.WriteHeader(tt.status)
		}))
		sender := NewWebPushSender(pub, priv, "mailto:admin@example.com")
		status, err := sender.Send(context.Background(), browserSubscription(t, srv.URL), []byte(`{"title":"x"}`))
		srv.Close()

		if err != nil || status != tt.status {
			t.Errorf("%s: status = %d, err = %v, want %d", tt.name, status, err, tt.status)
			continue
		}
		if !strings.HasPrefix(got.Header.Get("Authorization"), "vapid ") {
			t.Errorf("%s: authorization = %q, want a VAPID header", tt.name, got.Header.Get("Authorization"))
		}
		if got.Header.Get("TTL") != "600" {
			t.Errorf("%s: TTL = %q, want 600", tt.name, got.Header.Get("TTL"))
		}
	}
}

func TestWebPushSenderSendUnreachable(t *testing.T) {
	priv, pub, _ := webpush.GenerateVAPIDKeys()
	sender := NewWebPushSender(pub, priv, "mailto:admin@example.com")
	if _, err := sender.Send(context.Background(), browserSubscription(t, "http://127.0.0.1:1"), []byte("{}")); err == nil {
		t.Error("want an error for an unreachable push service")
	}
}
