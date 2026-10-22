package handler

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
)

func TestUsernameBase(t *testing.T) {
	tests := []struct {
		name, email, fullName, want string
	}{
		{"uses the email local part", "Joao.Silva@example.com", "Other Name", "joao.silva"},
		{"uses the name without an email", "", "José Conceição", "jose.conceicao"},
		{"strips accents", "ãéíõüç@example.com", "", "aeiouc"},
		{"drops characters outside the pattern", "a+b-c!d@example.com", "", "abcd"},
		{"collapses repeated separators", "a..b__c@example.com", "", "a.b_c"},
		{"collapses spaces in a name", "", "  Ana   Maria  ", "ana.maria"},
		{"trims separators at the ends", "._abc_.@example.com", "", "abc"},
		{"cuts to 30 characters", strings.Repeat("a", 40) + "@example.com", "", strings.Repeat("a", 30)},
		{"trims a separator left by the cut", strings.Repeat("a", 29) + ".b@example.com", "", strings.Repeat("a", 29)},
		{"returns empty when too short", "ab@example.com", "", ""},
		{"returns empty with nothing", "", "", ""},
		{"returns empty for symbols only", "", "!!!", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := usernameBase(tt.email, tt.fullName)
			if got != tt.want {
				t.Errorf("usernameBase(%q, %q) = %q, want %q", tt.email, tt.fullName, got, tt.want)
			}
			if got != "" && !usernamePattern.MatchString(got) {
				t.Errorf("usernameBase(%q, %q) = %q does not match the username pattern", tt.email, tt.fullName, got)
			}
		})
	}
}

func takenSet(names ...string) func(context.Context, string) (bool, error) {
	set := map[string]bool{}
	for _, n := range names {
		set[n] = true
	}
	return func(_ context.Context, u string) (bool, error) { return set[u], nil }
}

func TestSuggestUsername(t *testing.T) {
	long := strings.Repeat("a", 30)
	many := []string{"joao"}
	for i := 2; i <= 30; i++ {
		many = append(many, "joao"+strconv.Itoa(i))
	}
	tests := []struct {
		name  string
		base  string
		taken []string
		want  string
	}{
		{"returns a free base", "joao", nil, "joao"},
		{"appends 2 when the base is taken", "joao", []string{"joao"}, "joao2"},
		{"appends the first free number", "joao", []string{"joao", "joao2", "joao3"}, "joao4"},
		{"keeps the suffix within 30 characters", long, []string{long}, strings.Repeat("a", 29) + "2"},
		{"returns empty for an empty base", "", nil, ""},
		{"returns empty after too many tries", "joao", many, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := suggestUsername(context.Background(), tt.base, takenSet(tt.taken...))
			if err != nil || got != tt.want {
				t.Errorf("suggestUsername(%q) = %q, %v; want %q", tt.base, got, err, tt.want)
			}
		})
	}
}

func TestSuggestUsernameReturnsTheLookupError(t *testing.T) {
	boom := errors.New("boom")
	_, err := suggestUsername(context.Background(), "joao", func(context.Context, string) (bool, error) { return false, boom })
	if !errors.Is(err, boom) {
		t.Errorf("err = %v, want %v", err, boom)
	}
}

func TestSocialLoginSuggestsAUsername(t *testing.T) {
	tests := []struct {
		name string
		body string
		want string
	}{
		{"from the email", `{"provider":"google","id_token":"fresh"}`, `"suggested_username":"fresh"`},
		{"with a number when the email name is taken", `{"provider":"google","id_token":"taken-local"}`, `"suggested_username":"existing2"`},
		{"from the name without an email", `{"provider":"google","id_token":"no-email","name":"Zé Ninguém"}`, `"suggested_username":"ze.ninguem"`},
		{"empty when nothing fits", `{"provider":"google","id_token":"no-email"}`, `"suggested_username":""`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := newFakeSocialStore()
			store.addUser("existing", "other@example.com")
			w := postSocial(socialRouter(store, googleVerifier()), tt.body)
			body := w.Body.String()
			if w.Code != http.StatusConflict || !strings.Contains(body, tt.want) || !strings.Contains(body, `"needs_username":true`) {
				t.Errorf("got = %d %s, want 409 containing %s", w.Code, body, tt.want)
			}
		})
	}
}

func TestUsernameAvailable(t *testing.T) {
	tests := []struct {
		name  string
		query string
		want  string
	}{
		{"a free username", "?username=novo", `{"available":true,"valid":true}`},
		{"a taken username", "?username=existing", `{"available":false,"valid":true}`},
		{"trims and lowercases", "?username=%20EXISTING%20", `{"available":false,"valid":true}`},
		{"an invalid username", "?username=a", `{"available":false,"valid":false}`},
		{"a missing username", "", `{"available":false,"valid":false}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := newFakeSocialStore()
			store.addUser("existing", "")
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/api/auth/username-available"+tt.query, nil)
			socialRouter(store, googleVerifier()).ServeHTTP(w, req)
			if w.Code != http.StatusOK || w.Body.String() != tt.want {
				t.Errorf("got = %d %s, want 200 %s", w.Code, w.Body.String(), tt.want)
			}
		})
	}
}
