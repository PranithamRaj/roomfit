import { Linking, Platform } from 'react-native';
import { API_URL } from './config';

export const arPageUrl = (productId, { embed = false } = {}) => `${API_URL}/ar/${productId}${embed ? '?embed=1' : ''}`;

// AR runs in the system browser, which hands off to the OS AR viewer:
//  Android Chrome → Google Scene Viewer (ARCore), iOS Safari → AR Quick Look.
// Both place the model at true real-world scale, so no custom native build is needed.
export async function openInRoom(productId) {
  const url = arPageUrl(productId);
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener');
    return;
  }
  await Linking.openURL(url);
}

export const hasAr = (product) => Boolean(product?.modelUrl);
