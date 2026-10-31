package observability

import (
	"regexp"
	"time"

	"github.com/getsentry/sentry-go"
	sentrygin "github.com/getsentry/sentry-go/gin"
	"github.com/gin-gonic/gin"
)

var (
	secretHeaders = []string{"Authorization", "Cookie", "X-Cron-Secret"}
	emailPattern  = regexp.MustCompile(`[^\s@]+@[^\s@]+\.[^\s@]+`)
	bearerPattern = regexp.MustCompile(`(?i)(bearer\s+)[^\s"']+`)
	jwtPattern    = regexp.MustCompile(`eyJ[\w-]+\.[\w-]+\.[\w-]+`)
)

func hideSecrets(text string) string {
	text = emailPattern.ReplaceAllString(text, "[email]")
	text = bearerPattern.ReplaceAllString(text, "${1}[token]")
	return jwtPattern.ReplaceAllString(text, "[token]")
}

func Configured(dsn string) bool {
	return dsn != ""
}

func Scrub(event *sentry.Event) *sentry.Event {
	if event.Request != nil {
		for _, h := range secretHeaders {
			delete(event.Request.Headers, h)
		}
		event.Request.Cookies = ""
		event.Request.Data = ""
	}
	event.User = sentry.User{ID: event.User.ID}
	event.Message = hideSecrets(event.Message)
	for i := range event.Exception {
		event.Exception[i].Value = hideSecrets(event.Exception[i].Value)
	}
	return event
}

func Init(dsn, environment, release string) (func(), error) {
	if !Configured(dsn) {
		return func() {}, nil
	}
	err := sentry.Init(sentry.ClientOptions{
		Dsn:            dsn,
		Environment:    environment,
		Release:        release,
		SendDefaultPII: false,
		BeforeSend: func(event *sentry.Event, _ *sentry.EventHint) *sentry.Event {
			return Scrub(event)
		},
	})
	if err != nil {
		return func() {}, err
	}
	return func() { sentry.Flush(2 * time.Second) }, nil
}

func Middleware(dsn string) gin.HandlerFunc {
	if !Configured(dsn) {
		return func(c *gin.Context) { c.Next() }
	}
	return sentrygin.New(sentrygin.Options{Repanic: true})
}

func Capture(err error) {
	if err != nil {
		sentry.CaptureException(err)
	}
}
