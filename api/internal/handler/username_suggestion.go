package handler

import (
	"context"
	"strconv"
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

const (
	maxUsernameLength     = 30
	minUsernameLength     = 3
	maxUsernameSuggestion = 20
)

func usernameBase(email, name string) string {
	source := name
	if email != "" {
		source, _, _ = strings.Cut(email, "@")
	}
	var b strings.Builder
	var last rune
	for _, r := range norm.NFD.String(strings.ToLower(strings.TrimSpace(source))) {
		if unicode.Is(unicode.Mn, r) {
			continue
		}
		if unicode.IsSpace(r) {
			r = '.'
		}
		isSep := r == '.' || r == '_'
		if !isSep && (r < 'a' || r > 'z') && (r < '0' || r > '9') {
			continue
		}
		if isSep && (last == r || b.Len() == 0) {
			continue
		}
		b.WriteRune(r)
		last = r
	}
	out := b.String()
	if len(out) > maxUsernameLength {
		out = out[:maxUsernameLength]
	}
	out = strings.Trim(out, "._")
	if len(out) < minUsernameLength {
		return ""
	}
	return out
}

func suggestUsername(ctx context.Context, base string, taken func(context.Context, string) (bool, error)) (string, error) {
	if base == "" {
		return "", nil
	}
	for i := 1; i <= maxUsernameSuggestion; i++ {
		candidate := base
		if i > 1 {
			suffix := strconv.Itoa(i)
			stem := base
			if len(stem)+len(suffix) > maxUsernameLength {
				stem = stem[:maxUsernameLength-len(suffix)]
			}
			candidate = stem + suffix
		}
		exists, err := taken(ctx, candidate)
		if err != nil {
			return "", err
		}
		if !exists {
			return candidate, nil
		}
	}
	return "", nil
}
