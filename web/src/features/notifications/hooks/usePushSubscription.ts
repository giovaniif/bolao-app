import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../shared/query/queryKeys';
import { deletePushSubscription, getPushPublicKey, savePushSubscription } from '../api/pushApi';
import { readPushStatus, toSubscriptionBody, urlBase64ToUint8Array } from '../pushSupport';

async function enablePush() {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permissão de notificação negada');
  }
  const { public_key } = await getPushPublicKey();
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(public_key),
  });
  await savePushSubscription(toSubscriptionBody(subscription));
}

async function disablePush() {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await deletePushSubscription(subscription.endpoint);
  await subscription.unsubscribe();
}

export function usePushSubscription() {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: queryKeys.pushStatus,
    queryFn: () => readPushStatus(),
    staleTime: Infinity,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.pushStatus });
  const enable = useMutation({ mutationFn: enablePush, onSettled: invalidate });
  const disable = useMutation({ mutationFn: disablePush, onSettled: invalidate });

  return {
    status: status.data,
    isPending: enable.isPending || disable.isPending,
    error: enable.error ?? disable.error,
    enable: () => enable.mutate(),
    disable: () => disable.mutate(),
  };
}
