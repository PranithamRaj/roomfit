import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { DELIVERY_FEE, money } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { Button, Card, Chip, Empty, ErrorBox, Field, H2, Muted, Screen } from '../components/ui';
import { colors, space } from '../theme';

export default function Checkout() {
  const { user } = useAuth();
  const { cart, refresh } = useCart();
  const [shipping, setShipping] = useState({ name: user?.name || '', phone: '', address: '', city: '' });
  const [payment, setPayment] = useState('cod');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [placed, setPlaced] = useState(null);

  const set = (k) => (v) => setShipping((s) => ({ ...s, [k]: v }));
  const shopCount = new Set(cart.items.map((i) => i.product.shopId)).size;
  const total = cart.subtotal + shopCount * DELIVERY_FEE;

  if (placed) {
    return (
      <Screen>
        <Empty
          icon="checkmark-circle-outline"
          title="Order placed!"
          body={placed.length > 1
            ? `We split your purchase into ${placed.length} orders, one for each shop. You can track them in Orders.`
            : 'The shop will confirm your order shortly. Track it in Orders.'}
          action={<Button title="View my orders" onPress={() => router.replace('/orders')} />}
        />
      </Screen>
    );
  }
  if (!cart.items.length) {
    return <Screen><Empty icon="bag-outline" title="Your cart is empty" /></Screen>;
  }

  const submit = async () => {
    setError(null);
    const missing = Object.entries(shipping).find(([, v]) => !v.trim());
    if (missing) return setError(new Error(`Please fill in your ${missing[0]}`));
    setBusy(true);
    try {
      const res = await api.checkout({ shipping, paymentMethod: payment });
      await refresh();
      setPlaced(res.orders);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <H2 style={{ marginBottom: space(3) }}>Delivery details</H2>
      <Field label="Full name" value={shipping.name} onChangeText={set('name')} autoComplete="name" />
      <Field label="Phone" value={shipping.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel" />
      <Field label="Address" value={shipping.address} onChangeText={set('address')} autoComplete="street-address"
        hint="Include floor and lift access; large pieces may need it." />
      <Field label="City" value={shipping.city} onChangeText={set('city')} />

      <H2 style={{ marginVertical: space(3) }}>Payment</H2>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip label="Cash on delivery" icon="cash-outline" active={payment === 'cod'} onPress={() => setPayment('cod')} />
        <Chip label="Card on delivery" icon="card-outline" active={payment === 'card'} onPress={() => setPayment('card')} />
      </View>
      <Muted style={{ fontSize: 12 }}>You pay when your furniture arrives. No card details are collected in the app.</Muted>

      <Card style={{ marginTop: space(5) }}>
        {cart.items.map(({ product, qty, lineTotal }) => (
          <View key={product.id} style={styles.line}>
            <Text style={styles.lineName} numberOfLines={1}>{qty} × {product.name}</Text>
            <Text style={styles.lineVal}>{money(lineTotal)}</Text>
          </View>
        ))}
        <View style={styles.line}>
          <Muted>Delivery ({shopCount} {shopCount === 1 ? 'shop' : 'shops'})</Muted>
          <Muted>{money(shopCount * DELIVERY_FEE)}</Muted>
        </View>
        <View style={[styles.line, styles.totalLine]}>
          <Text style={styles.total}>Total</Text>
          <Text style={styles.total}>{money(total)}</Text>
        </View>
      </Card>

      <ErrorBox error={error} />
      <Button title={`Place order · ${money(total)}`} onPress={submit} loading={busy} style={{ marginTop: space(3) }} />
      <View style={styles.secure}>
        <Ionicons name="shield-checkmark-outline" size={14} color={colors.muted} />
        <Muted style={{ fontSize: 12 }}> Free cancellation until the shop confirms</Muted>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  lineName: { flex: 1, color: colors.ink, marginRight: 8 },
  lineVal: { color: colors.ink, fontWeight: '600' },
  totalLine: { borderTopWidth: 1, borderColor: colors.border, marginTop: 6, paddingTop: 8 },
  total: { fontSize: 17, fontWeight: '800', color: colors.ink },
  secure: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: space(3) },
});
