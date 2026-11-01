package config

import "testing"

func TestLoad_SentryEnvironmentHasNoDefault(t *testing.T) {
	t.Setenv("SENTRY_ENVIRONMENT", "")
	if got := Load().SentryEnvironment; got != "" {
		t.Errorf("SentryEnvironment = %q, want empty so local runs do not report", got)
	}
}
