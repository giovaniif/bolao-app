import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAuth } from '../auth/AuthProvider';
import { registerForPush } from './push';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function PushGate() {
  const { ready, token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && token) {
      registerForPush().catch(() => undefined);
    }
  }, [ready, token]);

  useEffect(() => {
    const openPredict = () => {
      router.push('/palpitar');
      Notifications.clearLastNotificationResponse();
    };
    if (Notifications.getLastNotificationResponse()?.notification) {
      openPredict();
    }
    const subscription = Notifications.addNotificationResponseReceivedListener(openPredict);
    return () => subscription.remove();
  }, [router]);

  return null;
}
