import type { ConfigContext, ExpoConfig } from 'expo/config';

function googleIosUrlScheme(iosClientId: string | undefined): string | null {
  const id = iosClientId?.trim();
  if (!id) return null;
  return `com.googleusercontent.apps.${id.replace(/\.apps\.googleusercontent\.com$/, '')}`;
}

export default function appConfig({ config }: ConfigContext): ExpoConfig {
  const scheme = googleIosUrlScheme(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
  const plugins = config.plugins ?? [];
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  return {
    ...config,
    android: googleServicesFile ? { ...config.android, googleServicesFile } : config.android,
    plugins: scheme ? [...plugins, ['@react-native-google-signin/google-signin', { iosUrlScheme: scheme }]] : plugins,
  } as ExpoConfig;
}
