import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 4000;

// Resolution order:
//  1. EXPO_PUBLIC_API_URL (set in .env) — use this for native builds against a deployed backend.
//  2. Web production build: the API lives on the same domain (e.g. Vercel).
//  3. Web dev / native dev: the machine running Metro (so a phone on the same Wi-Fi reaches your laptop).
//  4. Emulator / localhost fallbacks.
function resolveApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (!__DEV__) return window.location.origin;
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:${API_PORT}`;
  return Platform.OS === 'android' ? `http://10.0.2.2:${API_PORT}` : `http://localhost:${API_PORT}`;
}

export const API_URL = resolveApiUrl();

// Uploaded files are stored as server-relative paths.
export const assetUrl = (url) => (!url || /^https?:\/\//i.test(url) || url.startsWith('data:') ? url : `${API_URL}${url}`);
