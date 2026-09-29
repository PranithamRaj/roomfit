import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { assetUrl } from '../lib/config';
import { date, money } from '../lib/format';
import { Empty, ErrorBox, Loading, Muted, StatusPill } from './ui';
import { colors, radius, space } from '../theme';

// Shared by buyer "My orders" and seller "Incoming orders".
export default function OrderList({ state, perspective, emptyTitle, emptyBody, header }) {
  const { data, loading, error, reload } = state;
  if (loading) return <Loading />;
  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space(4), paddingBottom: space(10) }}
      data={data || []}
      keyExtractor={(o) => o.id}
      refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
      ListHeaderComponent={<>{header}<ErrorBox error={error} onRetry={reload} /></>}
      ListEmptyComponent={<Empty icon="receipt-outline" title={emptyTitle} body={emptyBody} />}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderItem={({ item: o }) => (
        <Pressable style={styles.card} onPress={() => router.push(`/order/${o.id}`)}>
          <View style={styles.top}>
            <Text style={styles.title}>{perspective === 'seller' ? o.shipping.name : o.shopName}</Text>
            <StatusPill status={o.status} />
          </View>
          <Muted style={{ fontSize: 12 }}>#{o.id.slice(0, 8).toUpperCase()} · {date(o.createdAt)}</Muted>
          <View style={styles.thumbs}>
            {o.items.slice(0, 4).map((i) => (
              <Image key={i.productId} source={{ uri: assetUrl(i.image) }} style={styles.thumb} />
            ))}
            <View style={{ flex: 1 }} />
            <Text style={styles.total}>{money(o.total)}</Text>
          </View>
          <Muted style={{ fontSize: 12 }} numberOfLines={1}>{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</Muted>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.border },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  title: { fontSize: 16, fontWeight: '700', color: colors.ink, flex: 1, marginRight: 8 },
  thumbs: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 8 },
  thumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#fff' },
  total: { fontSize: 16, fontWeight: '800', color: colors.ink },
});
