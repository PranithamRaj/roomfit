import { useEffect } from 'react';
import { View } from 'react-native';
import { arPageUrl } from '../lib/ar';
import { API_URL } from '../lib/config';
import { colors, radius } from '../theme';

// Web build: react-native-webview isn't available, so embed the same viewer in an iframe.
export default function ModelPreview({ productId, height = 320, onModelSize }) {
  useEffect(() => {
    if (!onModelSize) return undefined;
    const origin = new URL(API_URL).origin;
    const onMessage = (e) => {
      if (e.origin !== origin) return;
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'model-size') onModelSize(msg);
      } catch {
        // ignore unrelated messages
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onModelSize]);

  return (
    <View style={{ height, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' }}>
      <iframe
        title="3D model preview"
        src={arPageUrl(productId, { embed: true })}
        style={{ border: 0, width: '100%', height: '100%' }}
        allow="xr-spatial-tracking; fullscreen"
      />
    </View>
  );
}
