import { router } from 'expo-router';

// router.back() is a no-op when the screen was opened directly (web deep link, refresh),
// so fall back to a sensible parent route.
export function goBack(fallback) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
