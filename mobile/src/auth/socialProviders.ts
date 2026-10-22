import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { socialConfig } from './socialConfig';

export async function appleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export interface ProviderCredential {
  idToken: string;
  name?: string;
}

export async function appleIdToken(): Promise<ProviderCredential | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!credential.identityToken) return null;
    const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
    return name ? { idToken: credential.identityToken, name } : { idToken: credential.identityToken };
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as { code: unknown }).code === 'ERR_REQUEST_CANCELED') return null;
    throw new Error('Não foi possível entrar com a Apple. Tente de novo.');
  }
}

export function googleAvailable(): boolean {
  const { googleWebClientId, googleIosClientId } = socialConfig();
  if (Platform.OS === 'ios') return googleWebClientId !== '' && googleIosClientId !== '';
  return Platform.OS === 'android' && googleWebClientId !== '';
}

export async function googleIdToken(): Promise<ProviderCredential | null> {
  const { googleWebClientId, googleIosClientId } = socialConfig();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GoogleSignin } = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({ webClientId: googleWebClientId, iosClientId: googleIosClientId || undefined });
  try {
    await GoogleSignin.hasPlayServices();
    const res = await GoogleSignin.signIn();
    if (res.type !== 'success') return null;
    if (!res.data.idToken) return null;
    const name = res.data.user?.name;
    return name ? { idToken: res.data.idToken, name } : { idToken: res.data.idToken };
  } catch {
    throw new Error('Não foi possível entrar com o Google. Tente de novo.');
  }
}
