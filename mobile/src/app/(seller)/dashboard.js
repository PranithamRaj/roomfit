import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { money } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, Empty, ErrorBox, H1, H2, Loading, Muted, Screen } from '../../components/ui';
import { colors, space } from '../../theme';

export default function Dashboard() {
  const { shop, user } = useAuth();
  const { data, loading, error, reload } = useAsync(async () => {
    if (!shop) return null;
    const [mine, orders] = await Promise.all([api.myShop(), api.orders()]);
    return { products: mine.products, orders: orders.orders };
  }, [shop?.id], { refetchOnFocus: true });

  if (!shop) {
    return (
      <Screen>
        <Empty icon="storefront-outline" title={`Welcome, ${user.name.split(' ')[0]}`}
          body="Set up your shop profile, then list furniture with 3D models so shoppers can see it in their rooms."
          action={<Button title="Set up my shop" onPress={() => router.push('/seller/shop-form')} />} />
      </Screen>
    );
  }
  if (loading) return <Loading />;

  const products = data?.products || [];
  const orders = data?.orders || [];
  const active = orders.filter((o) => o.status !== 'cancelled');
  const stats = [
    { icon: 'time-outline', label: 'To confirm', value: orders.filter((o) => o.status === 'placed').length },
    { icon: 'car-outline', label: 'To ship', value: orders.filter((o) => o.status === 'confirmed').length },
    { icon: 'cube-outline', label: 'Products', value: products.length },
    { icon: 'scan-outline', label: 'AR-ready', value: products.filter((p) => p.modelUrl).length },
  ];
  const revenue = active.filter((o) => o.status === 'delivered').reduce((s, o) => s + o.subtotal, 0);
  const pipeline = active.filter((o) => o.status !== 'delivered').reduce((s, o) => s + o.subtotal, 0);
  const lowStock = products.filter((p) => p.stock <= 2);
  const noModel = products.filter((p) => !p.modelUrl);

  return (
    <Screen refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}>
      <H1>{shop.name}</H1>
      <Muted>{shop.city}</Muted>
      <ErrorBox error={error} onRetry={reload} />

      <View style={styles.grid}>
        {stats.map((s) => (
          <Card key={s.label} style={styles.stat}>
            <Ionicons name={s.icon} size={18} color={colors.accent} />
            <Text style={styles.statVal}>{s.value}</Text>
            <Muted style={{ fontSize: 12 }}>{s.label}</Muted>
          </Card>
        ))}
      </View>

      <Card style={{ marginTop: space(3) }}>
        <Muted style={{ fontSize: 12 }}>Delivered sales</Muted>
        <Text style={styles.money}>{money(revenue)}</Text>
        <Muted style={{ fontSize: 12, marginTop: 4 }}>{money(pipeline)} in open orders</Muted>
      </Card>

      {(lowStock.length > 0 || noModel.length > 0) && (
        <Card style={{ marginTop: space(3) }}>
          <H2 style={{ fontSize: 16, marginBottom: 6 }}>Needs attention</H2>
          {lowStock.map((p) => (
            <Muted key={`s${p.id}`}>• {p.name}: {p.stock === 0 ? 'out of stock' : `only ${p.stock} left`}</Muted>
          ))}
          {noModel.map((p) => (
            <Muted key={`m${p.id}`}>• {p.name}: add a 3D model so shoppers can view it in AR</Muted>
          ))}
        </Card>
      )}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: space(4) }}>
        <Button title="Add product" icon="add" style={{ flex: 1 }} onPress={() => router.push('/seller/product-form')} />
        <Button title="Orders" icon="receipt-outline" variant="outline" style={{ flex: 1 }} onPress={() => router.push('/sales')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: space(4) },
  stat: { flexBasis: '47%', flexGrow: 1, padding: 12 },
  statVal: { fontSize: 24, fontWeight: '800', color: colors.ink, marginTop: 4 },
  money: { fontSize: 26, fontWeight: '800', color: colors.ink, marginTop: 2 },
});
