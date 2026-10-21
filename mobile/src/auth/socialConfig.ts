export interface SocialConfig {
  googleWebClientId: string;
  googleIosClientId: string;
}

export function socialConfig(): SocialConfig {
  return {
    googleWebClientId: (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '').trim(),
    googleIosClientId: (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '').trim(),
  };
}
