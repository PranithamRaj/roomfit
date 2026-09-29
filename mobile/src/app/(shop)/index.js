import { FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { assetUrl } from '../../lib/config';
import { useAsync } from '../../lib/useAsync';
import { useAuth } from '../../context/AuthContext';
import ProductCard from '../../components/ProductCard';
import { Chip, ErrorBox, H2, Loading, Muted } from '../../components/ui';
import { colors, radius, shadow, space } from '../../theme';

const CATEGORY_ICONS = {
  Sofas: 'bed-outline', Chairs: 'easel-outline', Tables: 'grid-outline', Beds: 'moon-outline',
  Storage: 'file-tray-stacked-outline', Lighting: 'bulb-outline', Decor: 'flower-outline', Outdoor: 'sunny-outline',
};

export default function Home() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const { data, loading, error, reload } = useAsync(async () => {
    const [p, s, c] = await Promise.all([api.products({ sort: 'newest' }), api.shops(), api.categories()]);
    return { products: p.products, shops: s.shops, categories: c.categories };
  });

  if (loading) return <Loading />;
  const cardW = Math.min(200, (width - space(4) * 2 - 12) / 2);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: space(10) }} refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}>
        <View style={styles.top}>
          <View>
            <Text style={styles.hello}>{user ? `Hi, ${user.name.split(' ')[0]}` : 'Welcome to'}</Text>
            <Text style={styles.brand}>RoomFit</Text>
          </View>
          <Pressable onPress={() => router.push('/browse')} style={styles.searchBtn} accessibilityLabel="Search">
            <Ionicons name="search" size={20} color={colors.ink} />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: space(4) }}>
          <ErrorBox error={error} onRetry={reload} />
        </View>

        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>See it in your room before you buy</Text>
            <Text style={styles.heroBody}>
              Every piece with the AR badge can be placed in your home at its real size. Walk around it, check the fit, then order.
            </Text>
            <Pressable style={styles.heroCta} onPress={() => router.push({ pathname: '/browse', params: { arOnly: '1' } })}>
              <Ionicons name="cube-outline" size={16} color={colors.ink} />
              <Text style={styles.heroCtaText}>Shop AR-ready furniture</Text>
            </Pressable>
          </View>
        </View>

        {data && (
          <>
            <Section title="Shop by category">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space(4) }}>
                {data.categories.map((c) => (
                  <Chip key={c} label={c} icon={CATEGORY_ICONS[c]} onPress={() => router.push({ pathname: '/browse', params: { category: c } })} />
                ))}
              </ScrollView>
            </Section>

            <Section title="New arrivals" action={{ label: 'See all', onPress: () => router.push('/browse') }}>
              <FlatList
                horizontal
                data={data.products.slice(0, 8)}
                keyExtractor={(p) => p.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: space(4), gap: 12, paddingBottom: 6 }}
                renderItem={({ item }) => <ProductCard product={item} width={cardW} />}
              />
            </Section>

            <Section title="Shops near you">
              <View style={{ paddingHorizontal: space(4), gap: 12 }}>
                {data.shops.map((s) => (
                  <Pressable key={s.id} style={styles.shop} onPress={() => router.push(`/shop/${s.id}`)}>
                    {s.logo ? <Image source={{ uri: assetUrl(s.logo) }} style={styles.shopLogo} /> : <View style={[styles.shopLogo, { backgroundColor: colors.accentSoft }]} />}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.shopName}>{s.name}</Text>
                      <Muted numberOfLines={1}>{s.description}</Muted>
                      <Text style={styles.shopMeta}>
                        <Ionicons name="location-outline" size={12} /> {s.city || '—'} · {s.productCount} items
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                  </Pressable>
                ))}
              </View>
            </Section>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, action, children }) {
  return (
    <View style={{ marginTop: space(6) }}>
      <View style={styles.sectionHead}>
        <H2>{title}</H2>
        {action && (
          <Pressable onPress={action.onPress}>
            <Text style={styles.sectionAction}>{action.label}</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space(4), paddingBottom: space(2) },
  hello: { color: colors.muted, fontSize: 14 },
  brand: { color: colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  searchBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  hero: { marginHorizontal: space(4), marginTop: space(2), backgroundColor: colors.ink, borderRadius: radius.lg, padding: space(5), flexDirection: 'row', ...shadow },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', lineHeight: 27 },
  heroBody: { color: '#e6ddd4', fontSize: 14, marginTop: 8, lineHeight: 20 },
  heroCta: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9, marginTop: space(4) },
  heroCtaText: { fontWeight: '700', color: colors.ink },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: space(4), marginBottom: space(3) },
  sectionAction: { color: colors.accent, fontWeight: '600' },
  shop: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  shopLogo: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#fff' },
  shopName: { fontSize: 16, fontWeight: '700', color: colors.ink },
  shopMeta: { fontSize: 12, color: colors.muted, marginTop: 3 },
});
