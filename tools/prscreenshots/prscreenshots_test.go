package prscreenshots

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

const fakeGh = `#!/bin/sh
printf '%s\n' "$*" >> "$GH_LOG"
case "$*" in
  (*--jq*) [ -z "$FAKE_COMMENT_ID" ] || echo "$FAKE_COMMENT_ID" ;;
esac
`

type env struct {
	t      *testing.T
	remote string
	work   string
	shots  string
	bin    string
	log    string
}

func run(t *testing.T, dir string, name string, args ...string) string {
	t.Helper()
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("%s %v: %v\n%s", name, args, err, out)
	}
	return strings.TrimSpace(string(out))
}

func newEnv(t *testing.T, shots ...string) *env {
	t.Helper()
	root := t.TempDir()
	e := &env{
		t:      t,
		remote: filepath.Join(root, "remote.git"),
		work:   filepath.Join(root, "work"),
		shots:  filepath.Join(root, "shots"),
		bin:    filepath.Join(root, "bin"),
		log:    filepath.Join(root, "gh.log"),
	}
	run(t, root, "git", "init", "-q", "--bare", e.remote)
	run(t, root, "git", "init", "-q", "-b", "main", e.work)
	run(t, e.work, "git", "config", "user.email", "t@example.com")
	run(t, e.work, "git", "config", "user.name", "t")
	run(t, e.work, "git", "remote", "add", "origin", e.remote)
	if err := os.WriteFile(filepath.Join(e.work, "README.md"), []byte("x\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	run(t, e.work, "git", "add", "-A")
	run(t, e.work, "git", "commit", "-q", "-m", "chore: base")
	run(t, e.work, "git", "push", "-q", "origin", "main")
	for _, dir := range []string{e.shots, e.bin} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	for _, name := range shots {
		if err := os.WriteFile(filepath.Join(e.shots, name), []byte("png "+name), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(e.bin, "gh"), []byte(fakeGh), 0o755); err != nil {
		t.Fatal(err)
	}
	return e
}

func (e *env) post(pr string, extra ...string) (int, string) {
	e.t.Helper()
	script, err := filepath.Abs(filepath.Join("..", "pr-screenshots"))
	if err != nil {
		e.t.Fatal(err)
	}
	cmd := exec.Command("bash", script, pr, e.shots)
	cmd.Dir = e.work
	cmd.Env = append(os.Environ(),
		"PATH="+e.bin+string(os.PathListSeparator)+os.Getenv("PATH"),
		"GH_LOG="+e.log,
		"PR_SCREENSHOTS_REPO=octo/bolao",
		"PR_SCREENSHOTS_SHA=abcdef1234567",
	)
	cmd.Env = append(cmd.Env, extra...)
	out, err := cmd.CombinedOutput()
	code := 0
	if ee, ok := err.(*exec.ExitError); ok {
		code = ee.ExitCode()
	} else if err != nil {
		e.t.Fatal(err)
	}
	return code, string(out)
}

func (e *env) ghLog() string {
	e.t.Helper()
	b, err := os.ReadFile(e.log)
	if err != nil && !os.IsNotExist(err) {
		e.t.Fatal(err)
	}
	return string(b)
}

func (e *env) branchFiles() string {
	e.t.Helper()
	return run(e.t, e.remote, "git", "ls-tree", "-r", "--name-only", "pr-screenshots")
}

func TestScreenshotsArePushedUnderThePRAndCommit(t *testing.T) {
	e := newEnv(t, "login.png", "perfil.png")
	if code, out := e.post("7"); code != 0 {
		t.Fatalf("exit %d, want 0\n%s", code, out)
	}
	files := e.branchFiles()
	for _, want := range []string{"pr-7/abcdef1/login.png", "pr-7/abcdef1/perfil.png"} {
		if !strings.Contains(files, want) {
			t.Errorf("pr-screenshots branch has %q, want it to hold %s", files, want)
		}
	}
}

func TestALaterPRKeepsTheEarlierScreenshots(t *testing.T) {
	e := newEnv(t, "login.png")
	if code, out := e.post("7"); code != 0 {
		t.Fatalf("first post: exit %d\n%s", code, out)
	}
	if code, out := e.post("8"); code != 0 {
		t.Fatalf("second post: exit %d\n%s", code, out)
	}
	files := e.branchFiles()
	if !strings.Contains(files, "pr-7/abcdef1/login.png") || !strings.Contains(files, "pr-8/abcdef1/login.png") {
		t.Fatalf("pr-screenshots branch has %q, want the screenshots of both PRs", files)
	}
}

func TestNewCommentEmbedsEachScreenshotFromTheBranch(t *testing.T) {
	e := newEnv(t, "login.png", "perfil.png")
	if code, out := e.post("7"); code != 0 {
		t.Fatalf("exit %d\n%s", code, out)
	}
	log := e.ghLog()
	if !strings.Contains(log, "api repos/octo/bolao/issues/7/comments -f body=") {
		t.Fatalf("gh calls:\n%s\nwant a POST of a new comment on PR 7", log)
	}
	for _, want := range []string{
		"https://raw.githubusercontent.com/octo/bolao/pr-screenshots/pr-7/abcdef1/login.png",
		"https://raw.githubusercontent.com/octo/bolao/pr-screenshots/pr-7/abcdef1/perfil.png",
		"<!-- ui-screenshots -->",
	} {
		if !strings.Contains(log, want) {
			t.Errorf("comment body does not contain %s\n%s", want, log)
		}
	}
}

func TestExistingCommentIsUpdatedNotDuplicated(t *testing.T) {
	e := newEnv(t, "login.png")
	if code, out := e.post("7", "FAKE_COMMENT_ID=99"); code != 0 {
		t.Fatalf("exit %d\n%s", code, out)
	}
	log := e.ghLog()
	if !strings.Contains(log, "api -X PATCH repos/octo/bolao/issues/comments/99 -f body=") {
		t.Fatalf("gh calls:\n%s\nwant a PATCH of comment 99", log)
	}
	if strings.Contains(log, "api repos/octo/bolao/issues/7/comments -f body=") {
		t.Fatalf("gh calls:\n%s\nwant no second comment", log)
	}
}

func TestNoScreenshotsFails(t *testing.T) {
	e := newEnv(t)
	code, out := e.post("7")
	if code == 0 || !strings.Contains(out, "no screenshots") {
		t.Fatalf("exit %d, want a failure that says no screenshots\n%s", code, out)
	}
	if log := e.ghLog(); log != "" {
		t.Fatalf("gh calls:\n%s\nwant none", log)
	}
}

func TestBranchTurnsOffVercelGitDeploys(t *testing.T) {
	e := newEnv(t, "login.png")
	if code, out := e.post("7"); code != 0 {
		t.Fatalf("exit %d\n%s", code, out)
	}
	got := run(t, e.remote, "git", "show", "pr-screenshots:web/vercel.json")
	if !strings.Contains(got, `"deploymentEnabled": false`) {
		t.Fatalf("web/vercel.json on pr-screenshots is %q, want git.deploymentEnabled false so Vercel does not build the branch", got)
	}
}
