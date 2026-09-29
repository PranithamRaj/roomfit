import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, shadow } from '../theme';
import { money } from '../lib/format';
import { assetUrl } from '../lib/config';
import { hasAr } from '../lib/ar';
import { Badge } from './ui';

export default function ProductCard({ product, width, style }) {
  return (
    <Pressable
      onPress={() => router.push(`/product/${product.id}`)}
      style={({ pressed }) => [styles.card, width && { width }, pressed && { opacity: 0.9 }, style]}
      role="button"
      accessibilityLabel={`${product.name}, ${money(product.price)}`}
    >
      <View style={styles.imageWrap}>
        {product.images?.[0] ? (
          <Image source={{ uri: assetUrl(product.images[0]) }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, { backgroundColor: colors.accentSoft }]} />
        )}
        {hasAr(product) && (
          <View style={styles.badge}>
            <Badge label="View in AR" icon="cube-outline" tone="dark" />
          </View>
        )}
      </View>
      <View style={{ padding: 10 }}>
        <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
        <Text style={styles.shop} numberOfLines={1}>{product.shop?.name}</Text>
        <Text style={styles.price}>{money(product.price)}</Text>
        <Text style={styles.dims} numberOfLines={1}>
          {product.dimensions.width}×{product.dimensions.depth}×{product.dimensions.height} cm
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, ...shadow },
  imageWrap: { aspectRatio: 1, backgroundColor: '#fff' },
  image: { width: '100%', height: '100%' },
  badge: { position: 'absolute', left: 8, top: 8 },
  name: { fontSize: 15, fontWeight: '600', color: colors.ink },
  shop: { fontSize: 12, color: colors.muted, marginTop: 1 },
  price: { fontSize: 16, fontWeight: '700', color: colors.accent, marginTop: 6 },
  dims: { fontSize: 11, color: colors.muted, marginTop: 2 },
});
