import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { arPageUrl } from '../lib/ar';
import { colors, radius } from '../theme';

// Interactive 3D preview (rotate / zoom). AR placement itself is launched via openInRoom().
export default function ModelPreview({ productId, height = 320, onModelSize }) {
  const [loading, setLoading] = useState(true);
  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        source={{ uri: arPageUrl(productId, { embed: true }) }}
        style={{ backgroundColor: 'transparent' }}
        originWhitelist={['*']}
        onLoadEnd={() => setLoading(false)}
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data);
            if (msg.type === 'model-size') onModelSize?.(msg);
          } catch {
            // ignore unrelated messages
          }
        }}
        scrollEnabled={false}
        nestedScrollEnabled
        allowsInlineMediaPlayback
      />
      {loading && (
        <View style={styles.loader} pointerEvents="none">
          <ActivityIndicator color={colors.accent} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  loader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
