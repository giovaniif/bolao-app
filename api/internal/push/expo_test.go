package push

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/bolao-app/api/internal/models"
)

type expoServer struct {
	mu       sync.Mutex
	batches  [][]models.ExpoMessage
	auth     []string
	status   int
	rejected map[string]string
}

func (s *expoServer) handler(w http.ResponseWriter, r *http.Request) {
	var batch []models.ExpoMessage
	if err := json.NewDecoder(r.Body).Decode(&batch); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	s.mu.Lock()
	s.batches = append(s.batches, batch)
	s.auth = append(s.auth, r.Header.Get("Authorization"))
	s.mu.Unlock()
	if s.status != 0 {
		w.WriteHeader(s.status)
		return
	}
	data := make([]map[string]any, len(batch))
	for i, m := range batch {
		if code, ok := s.rejected[m.To]; ok {
			data[i] = map[string]any{"status": "error", "message": "rejected", "details": map[string]string{"error": code}}
			continue
		}
		data[i] = map[string]any{"status": "ok", "id": fmt.Sprintf("ticket-%d", i)}
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"data": data})
}

func messages(n int) []models.ExpoMessage {
	msgs := make([]models.ExpoMessage, n)
	for i := range msgs {
		msgs[i] = models.ExpoMessage{To: fmt.Sprintf("ExponentPushToken[%d]", i), Title: "Rodada 7 aberta"}
	}
	return msgs
}

func TestExpoSenderSendsInBatchesOfAHundred(t *testing.T) {
	srv := &expoServer{}
	ts := httptest.NewServer(http.HandlerFunc(srv.handler))
	defer ts.Close()

	results, err := NewExpoSender(ts.URL, "", ts.Client()).Send(context.Background(), messages(150))
	if err != nil {
		t.Fatalf("Send: %v", err)
	}
	if len(srv.batches) != 2 || len(srv.batches[0]) != 100 || len(srv.batches[1]) != 50 {
		t.Errorf("batch sizes = %d batches, want 100 then 50", len(srv.batches))
	}
	if len(results) != 150 {
		t.Fatalf("results = %d, want one per message", len(results))
	}
	for i, r := range results {
		if !r.OK || r.Token != fmt.Sprintf("ExponentPushToken[%d]", i) {
			t.Errorf("result %d = %+v, want ok for its own token", i, r)
		}
	}
}

func TestExpoSenderMarksDevicesThatAreNotRegistered(t *testing.T) {
	srv := &expoServer{rejected: map[string]string{"ExponentPushToken[1]": "DeviceNotRegistered", "ExponentPushToken[2]": "MessageRateExceeded"}}
	ts := httptest.NewServer(http.HandlerFunc(srv.handler))
	defer ts.Close()

	results, err := NewExpoSender(ts.URL, "", ts.Client()).Send(context.Background(), messages(3))
	if err != nil {
		t.Fatalf("Send: %v", err)
	}
	want := []models.ExpoResult{
		{Token: "ExponentPushToken[0]", OK: true},
		{Token: "ExponentPushToken[1]", DeviceNotRegistered: true},
		{Token: "ExponentPushToken[2]"},
	}
	for i := range want {
		if results[i] != want[i] {
			t.Errorf("result %d = %+v, want %+v", i, results[i], want[i])
		}
	}
}

func TestExpoSenderSendsTheAccessTokenOnlyWhenSet(t *testing.T) {
	for _, tt := range []struct{ token, want string }{{"", ""}, {"secret", "Bearer secret"}} {
		srv := &expoServer{}
		ts := httptest.NewServer(http.HandlerFunc(srv.handler))
		if _, err := NewExpoSender(ts.URL, tt.token, ts.Client()).Send(context.Background(), messages(1)); err != nil {
			t.Fatalf("Send: %v", err)
		}
		ts.Close()
		if srv.auth[0] != tt.want {
			t.Errorf("token %q: Authorization = %q, want %q", tt.token, srv.auth[0], tt.want)
		}
	}
}

func TestExpoSenderFailsOnAnErrorStatus(t *testing.T) {
	srv := &expoServer{status: http.StatusInternalServerError}
	ts := httptest.NewServer(http.HandlerFunc(srv.handler))
	defer ts.Close()

	if _, err := NewExpoSender(ts.URL, "", ts.Client()).Send(context.Background(), messages(1)); err == nil {
		t.Error("want an error when Expo answers 500")
	}
}

func TestExpoSenderSendsNothingForNoMessages(t *testing.T) {
	srv := &expoServer{}
	ts := httptest.NewServer(http.HandlerFunc(srv.handler))
	defer ts.Close()

	results, err := NewExpoSender(ts.URL, "", ts.Client()).Send(context.Background(), nil)
	if err != nil || len(results) != 0 || len(srv.batches) != 0 {
		t.Errorf("results = %v, err = %v, requests = %d; want no request", results, err, len(srv.batches))
	}
}
