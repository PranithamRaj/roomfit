import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { assetUrl } from '../../lib/config';
import { money } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Empty, ErrorBox, Loading, Muted } from '../../components/ui';
import { colors, radius, space } from '../../theme';

export default function SellerProducts() {
  const { shop } = useAuth();
  const { data, loading, error, reload } = useAsync(
    () => (shop ? api.myShop().then((r) => r.products) : Promise.resolve([])),
    [shop?.id],
    { refetchOnFocus: true },
  );

  if (loading) return <Loading />;
  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space(4), paddingBottom: space(10) }}
      data={data || []}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={
        <>
          <ErrorBox error={error} onRetry={reload} />
          {shop && <Button title="Add product" icon="add" onPress={() => router.push('/seller/product-form')} style={{ marginBottom: space(4) }} />}
        </>
      }
      ListEmptyComponent={
        <Empty icon="cube-outline" title={shop ? 'No products yet' : 'Set up your shop first'}
          body={shop ? 'Add your first piece. Include a .glb 3D model so buyers can place it in their room.' : undefined}
          action={!shop && <Button title="Set up shop" onPress={() => router.push('/seller/shop-form')} />} />
      }
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderItem={({ item: p }) => (
        <Pressable style={styles.row} onPress={() => router.push({ pathname: '/seller/product-form', params: { id: p.id } })}>
          <Image source={{ uri: assetUrl(p.images?.[0]) }} style={styles.thumb} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
            <Muted style={{ fontSize: 12 }}>{p.category} · {p.dimensions.width}×{p.dimensions.depth}×{p.dimensions.height} cm</Muted>
            <View style={styles.meta}>
              <Text style={styles.price}>{money(p.price)}</Text>
              <Text style={[styles.stock, p.stock <= 2 && { color: colors.danger }]}>{p.stock} in stock</Text>
              {p.modelUrl ? <Badge label="AR" icon="cube-outline" tone="success" /> : <Badge label="No 3D" />}
            </View>
          </View>
          <Ionicons name="create-outline" size={20} color={colors.muted} />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: '#fff' },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  price: { fontWeight: '700', color: colors.ink },
  stock: { fontSize: 12, color: colors.muted },
});
