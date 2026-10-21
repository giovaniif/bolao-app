package config

import (
	"reflect"
	"testing"
)

func TestLoadReadsSocialClientIDLists(t *testing.T) {
	t.Setenv("APPLE_CLIENT_IDS", " com.example.app , web.example ,")
	t.Setenv("GOOGLE_CLIENT_IDS", "")
	cfg := Load()
	if want := []string{"com.example.app", "web.example"}; !reflect.DeepEqual(cfg.AppleClientIDs, want) {
		t.Errorf("AppleClientIDs = %v, want %v", cfg.AppleClientIDs, want)
	}
	if len(cfg.GoogleClientIDs) != 0 {
		t.Errorf("GoogleClientIDs = %v, want none", cfg.GoogleClientIDs)
	}
}
