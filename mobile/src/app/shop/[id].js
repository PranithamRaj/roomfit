import { FlatList, Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { assetUrl } from '../../lib/config';
import { useAsync } from '../../lib/useAsync';
import ProductCard from '../../components/ProductCard';
import { Empty, ErrorBox, H1, Loading, Muted, Screen } from '../../components/ui';
import { colors, radius, space } from '../../theme';

export default function ShopDetail() {
  const { id } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const { data, loading, error, reload } = useAsync(() => api.shop(id), [id]);

  if (loading) return <Loading />;
  if (!data) return <Screen><ErrorBox error={error} onRetry={reload} /></Screen>;

  const { shop, products } = data;
  const columns = width > 700 ? 3 : 2;
  const cardW = (width - space(4) * 2 - 12 * (columns - 1)) / columns;

  return (
    <>
      <Stack.Screen options={{ title: shop.name }} />
      <FlatList
        key={columns}
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: space(4), paddingBottom: space(10) }}
        data={products}
        numColumns={columns}
        columnWrapperStyle={{ gap: 12 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={
          <View style={{ marginBottom: space(4) }}>
            {shop.coverImage ? <Image source={{ uri: assetUrl(shop.coverImage) }} style={styles.cover} /> : null}
            <View style={styles.head}>
              {shop.logo ? <Image source={{ uri: assetUrl(shop.logo) }} style={styles.logo} /> : null}
              <View style={{ flex: 1 }}>
                <H1 style={{ fontSize: 22 }}>{shop.name}</H1>
                <Text style={styles.meta}>
                  <Ionicons name="location-outline" size={13} /> {[shop.address, shop.city].filter(Boolean).join(', ') || '—'}
                </Text>
              </View>
            </View>
            {shop.description ? <Muted style={{ marginTop: space(2) }}>{shop.description}</Muted> : null}
            <Text style={styles.count}>{products.length} pieces</Text>
          </View>
        }
        ListEmptyComponent={<Empty title="No products yet" body="This shop hasn't listed anything yet." />}
        renderItem={({ item }) => <ProductCard product={item} width={cardW} />}
      />
    </>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', height: 160, borderRadius: radius.md, backgroundColor: '#fff' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: space(3) },
  logo: { width: 60, height: 60, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  meta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  count: { marginTop: space(4), fontWeight: '700', color: colors.ink },
});
