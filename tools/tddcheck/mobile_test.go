package tddcheck

import (
	"strings"
	"testing"
)

func TestCommitMixingMobileTestAndCodeFails(t *testing.T) {
	r := newRepo(t, map[string]string{"mobile/src/a.ts": "export const a = 'a';\n"})
	r.commit("feat(mobile): a is b", map[string]string{
		"mobile/src/a.ts":      "export const a = 'b';\n",
		"mobile/src/a.test.ts": "it('a is b', () => {});\n",
	})
	code, out := r.check()
	if code != 1 || !strings.Contains(out, "changes tests and production code together") {
		t.Fatalf("exit %d, want 1 naming the mixed commit\n%s", code, out)
	}
}

func TestMobileTestHelpersCountAsTests(t *testing.T) {
	r := newRepo(t, map[string]string{"mobile/src/a.ts": "export const a = 'a';\n"})
	r.commit("test(mobile): a render helper and its setup", map[string]string{
		"mobile/src/test/render.tsx": "export const render = 1;\n",
		"mobile/jest.setup.ts":       "export {};\n",
		"mobile/src/a.test.tsx":      "it('a', () => {});\n",
	})
	code, out := r.check()
	if code != 0 {
		t.Fatalf("exit %d, want 0: a test-only commit\n%s", code, out)
	}
}
