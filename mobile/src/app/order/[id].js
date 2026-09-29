import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { assetUrl } from '../../lib/config';
import { date, money, SELLER_NEXT, STATUS_LABEL } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, ErrorBox, H2, Loading, Muted, Screen, StatusPill } from '../../components/ui';
import { colors, space } from '../../theme';

const STEPS = ['placed', 'confirmed', 'shipped', 'delivered'];
const ACTION_LABEL = { confirmed: 'Confirm order', shipped: 'Mark as shipped', delivered: 'Mark as delivered', cancelled: 'Cancel order' };

export default function OrderDetail() {
  const { id } = useLocalSearchParams();
  const { isSeller } = useAuth();
  const { data, loading, error, reload } = useAsync(() => api.order(id).then((r) => r.order), [id]);
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState(null);

  if (loading) return <Loading />;
  if (!data) return <Screen><ErrorBox error={error} onRetry={reload} /></Screen>;
  const o = data;

  const actions = isSeller ? SELLER_NEXT[o.status] : o.status === 'placed' ? ['cancelled'] : [];
  const change = async (status) => {
    setBusy(status);
    setActionError(null);
    try {
      await api.setOrderStatus(o.id, status);
      await reload();
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(null);
    }
  };

  const reached = STEPS.indexOf(o.status);

  return (
    <Screen>
      <View style={styles.head}>
        <View>
          <H2>#{o.id.slice(0, 8).toUpperCase()}</H2>
          <Muted>{isSeller ? `For ${o.shipping.name}` : o.shopName} · {date(o.createdAt)}</Muted>
        </View>
        <StatusPill status={o.status} />
      </View>

      {o.status !== 'cancelled' && (
        <View style={styles.steps}>
          {STEPS.map((s, i) => (
            <View key={s} style={styles.step}>
              <View style={[styles.dot, i <= reached && { backgroundColor: colors.success, borderColor: colors.success }]}>
                {i <= reached && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text style={[styles.stepText, i <= reached && { color: colors.ink, fontWeight: '600' }]}>{STATUS_LABEL[s]}</Text>
            </View>
          ))}
        </View>
      )}

      <Card>
        {o.items.map((i) => (
          <View key={i.productId} style={styles.item}>
            <Image source={{ uri: assetUrl(i.image) }} style={styles.thumb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{i.name}</Text>
              <Muted>{i.qty} × {money(i.price)}</Muted>
            </View>
            <Text style={styles.name}>{money(i.qty * i.price)}</Text>
          </View>
        ))}
        <View style={styles.sum}><Muted>Delivery</Muted><Muted>{money(o.deliveryFee)}</Muted></View>
        <View style={styles.sum}><Text style={styles.total}>Total</Text><Text style={styles.total}>{money(o.total)}</Text></View>
        <Muted style={{ fontSize: 12 }}>Payment: {o.paymentMethod === 'card' ? 'Card on delivery' : 'Cash on delivery'}</Muted>
      </Card>

      <Card style={{ marginTop: space(4) }}>
        <H2 style={{ fontSize: 16 }}>Deliver to</H2>
        <Text style={styles.addr}>{o.shipping.name} · {o.shipping.phone}</Text>
        <Muted>{o.shipping.address}, {o.shipping.city}</Muted>
      </Card>

      <ErrorBox error={actionError} />
      <View style={{ gap: 10, marginTop: space(4) }}>
        {actions.map((s) => (
          <Button key={s} title={ACTION_LABEL[s]} variant={s === 'cancelled' ? 'danger' : 'primary'} loading={busy === s}
            disabled={!!busy} onPress={() => change(s)} />
        ))}
      </View>

      <H2 style={{ fontSize: 16, marginTop: space(6) }}>History</H2>
      {o.history.map((h) => (
        <Muted key={h.at + h.status} style={{ marginTop: 4 }}>{STATUS_LABEL[h.status]} · {new Date(h.at).toLocaleString()}</Muted>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space(4) },
  steps: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space(4) },
  step: { alignItems: 'center', flex: 1 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 12, color: colors.muted, marginTop: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  thumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: '#fff' },
  name: { fontWeight: '600', color: colors.ink },
  sum: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  total: { fontSize: 16, fontWeight: '800', color: colors.ink },
  addr: { color: colors.ink, fontWeight: '600', marginTop: 6 },
});
