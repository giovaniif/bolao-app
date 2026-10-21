import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { registerExpoToken, unregisterExpoToken } from '../api/push';

const ASKED_KEY = 'push-asked';
const TOKEN_KEY = 'push-token';
const ANDROID_CHANNEL = 'default';

async function hasPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') {
    return true;
  }
  if (!current.canAskAgain || (await SecureStore.getItemAsync(ASKED_KEY))) {
    return false;
  }
  await SecureStore.setItemAsync(ASKED_KEY, '1');
  const asked = await Notifications.requestPermissionsAsync();
  return asked.status === 'granted';
}

export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
      name: 'Lembretes',
      importance: AndroidImportance.HIGH,
    });
  }
  if (!(await hasPermission())) {
    return null;
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) {
    return null;
  }
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await registerExpoToken(token, Platform.OS === 'android' ? 'android' : 'ios');
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  return token;
}

export async function unregisterForPush(): Promise<void> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) {
    return;
  }
  try {
    await unregisterExpoToken(token);
  } catch {
  } finally {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}
