import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { assetUrl } from '../lib/config';
import { CONTACT_LABEL, date } from '../lib/format';
import { Empty, ErrorBox, Loading, Muted, StatusPill } from './ui';
import { colors, radius, space } from '../theme';

// Shared by the shopper's "My enquiries", the seller's enquiry inbox and the admin's all-enquiries view.
export default function EnquiryList({ state, perspective, emptyTitle, emptyBody, header }) {
  const { data, loading, error, reload } = state;
  if (loading) return <Loading />;
  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space(4), paddingBottom: space(10) }}
      data={data || []}
      keyExtractor={(e) => e.id}
      refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
      ListHeaderComponent={<>{header}<ErrorBox error={error} onRetry={reload} /></>}
      ListEmptyComponent={<Empty icon="chatbubbles-outline" title={emptyTitle} body={emptyBody} />}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderItem={({ item: e }) => (
        <Pressable style={styles.card} onPress={() => router.push(`/enquiry/${e.id}`)} role="button">
          <Image source={{ uri: assetUrl(e.productImage) }} style={styles.thumb} />
          <View style={{ flex: 1 }}>
            <View style={styles.top}>
              <Text style={styles.title} numberOfLines={1}>
                {perspective === 'buyer' ? e.productName : e.name}
              </Text>
              <StatusPill status={e.status} />
            </View>
            <Muted style={{ fontSize: 12 }} numberOfLines={1}>
              {perspective === 'seller' ? e.productName : perspective === 'admin' ? `${e.productName} · ${e.shopName}` : e.shopName} · {date(e.createdAt)}
            </Muted>
            <Text style={styles.message} numberOfLines={2}>{e.message}</Text>
            {perspective !== 'buyer' && (
              <View style={styles.meta}>
                <Ionicons name={e.preferredContact === 'whatsapp' ? 'logo-whatsapp' : e.preferredContact === 'email' ? 'mail-outline' : 'call-outline'} size={12} color={colors.muted} />
                <Muted style={{ fontSize: 12 }}> Prefers {CONTACT_LABEL[e.preferredContact]}</Muted>
              </View>
            )}
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 12, backgroundColor: colors.card, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.border },
  thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: '#fff' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink, flex: 1 },
  message: { fontSize: 13, color: colors.ink, marginTop: 4, lineHeight: 18 },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
});
