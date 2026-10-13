package push

import (
	"context"
	"strings"

	"github.com/SherClockHolmes/webpush-go"
	"github.com/bolao-app/api/internal/models"
)

const ttlSeconds = 10 * 60

type WebPushSender struct {
	publicKey  string
	privateKey string
	subject    string
}

func NewWebPushSender(publicKey, privateKey, subject string) *WebPushSender {
	return &WebPushSender{publicKey: publicKey, privateKey: privateKey, subject: strings.TrimPrefix(subject, "mailto:")}
}

func (s *WebPushSender) Send(ctx context.Context, sub models.PushSubscription, payload []byte) (int, error) {
	resp, err := webpush.SendNotificationWithContext(ctx, payload, &webpush.Subscription{
		Endpoint: sub.Endpoint,
		Keys:     webpush.Keys{P256dh: sub.P256dh, Auth: sub.Auth},
	}, &webpush.Options{
		Subscriber:      s.subject,
		VAPIDPublicKey:  s.publicKey,
		VAPIDPrivateKey: s.privateKey,
		TTL:             ttlSeconds,
		Urgency:         webpush.UrgencyHigh,
	})
	if err != nil {
		return 0, err
	}
	defer func() { _ = resp.Body.Close() }()
	return resp.StatusCode, nil
}
