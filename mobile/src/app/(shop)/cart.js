import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { assetUrl } from '../../lib/config';
import { DELIVERY_FEE, money } from '../../lib/format';
import { Button, Card, Empty, ErrorBox, Muted, QtyStepper, Screen } from '../../components/ui';
import { colors, radius, space } from '../../theme';


export default function Cart() {
  const { user } = useAuth();
  const { cart, setQty, refresh } = useCart();
  const [error, setError] = useState(null);

  useFocusEffect(useCallback(() => { refresh().catch(setError); }, [refresh]));

  if (!user) {
    return (
      <Screen>
        <Empty icon="bag-outline" title="Sign in to start a cart" body="Save pieces you love and check out when you're ready."
          action={<Button title="Sign in" onPress={() => router.push('/login')} />} />
      </Screen>
    );
  }
  if (!cart.items.length) {
    return (
      <Screen>
        <Empty icon="bag-outline" title="Your cart is empty" body="Browse pieces and try them in your room with AR."
          action={<Button title="Start browsing" onPress={() => router.push('/browse')} />} />
      </Screen>
    );
  }

  const shopCount = new Set(cart.items.map((i) => i.product.shopId)).size;
  const delivery = shopCount * DELIVERY_FEE;

  const change = async (productId, qty) => {
    setError(null);
    try {
      await setQty(productId, Math.max(0, qty));
    } catch (e) {
      setError(e);
    }
  };

  return (
    <Screen>
      <ErrorBox error={error} />
      {cart.items.map(({ product, qty, lineTotal }) => (
        <Pressable key={product.id} onPress={() => router.push(`/product/${product.id}`)} style={styles.item}>
          <Image source={{ uri: assetUrl(product.images?.[0]) }} style={styles.thumb} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
            <Muted style={{ fontSize: 12 }}>{product.shop?.name}</Muted>
            <View style={styles.itemBottom}>
              <Text style={styles.price}>{money(lineTotal)}</Text>
              <QtyStepper value={qty} max={product.stock} onChange={(n) => change(product.id, n)} />
            </View>
          </View>
        </Pressable>
      ))}

      <Card style={{ marginTop: space(2) }}>
        <Row label={`Subtotal (${cart.count} items)`} value={money(cart.subtotal)} />
        <Row label={`Delivery${shopCount > 1 ? ` · ${shopCount} shops` : ''}`} value={money(delivery)} />
        <View style={styles.divider} />
        <Row label="Total" value={money(cart.subtotal + delivery)} bold />
        {shopCount > 1 && (
          <Muted style={{ fontSize: 12, marginTop: 6 }}>Items from different shops ship separately, as one order per shop.</Muted>
        )}
      </Card>
      <Button title="Checkout" icon="lock-closed-outline" style={{ marginTop: space(4) }} onPress={() => router.push('/checkout')} />
    </Screen>
  );
}

const Row = ({ label, value, bold }) => (
  <View style={styles.sumRow}>
    <Text style={[styles.sumLabel, bold && styles.bold]}>{label}</Text>
    <Text style={[styles.sumLabel, bold && styles.bold]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  item: { flexDirection: 'row', gap: 12, backgroundColor: colors.card, borderRadius: radius.md, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  thumb: { width: 84, height: 84, borderRadius: radius.sm, backgroundColor: '#fff' },
  name: { fontSize: 15, fontWeight: '600', color: colors.ink },
  itemBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' },
  price: { fontSize: 16, fontWeight: '700', color: colors.ink },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  sumLabel: { fontSize: 15, color: colors.ink },
  bold: { fontWeight: '800', fontSize: 17 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
});
