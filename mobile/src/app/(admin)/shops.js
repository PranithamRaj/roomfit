import { useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { assetUrl } from '../../lib/config';
import { duration } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { useLiveRefresh } from '../../lib/live';
import { Badge, Empty, ErrorBox, Loading, Muted, SearchBar } from '../../components/ui';
import { colors, radius, space } from '../../theme';

// Every shop with how it's performing; shops with enquiries waiting for a reply come first.
export default function Shops() {
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useAsync(() => api.adminShops().then((r) => r.shops));
  useLiveRefresh(reload, () => true);

  if (loading) return <Loading />;
  const term = q.trim().toLowerCase();
  const shown = (data || []).filter((s) => !term || `${s.name} ${s.city} ${s.owner?.name} ${s.owner?.email}`.toLowerCase().includes(term));

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space(4), paddingBottom: space(10) }}
      data={shown}
      keyExtractor={(s) => s.id}
      refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ marginBottom: space(3) }}>
          <ErrorBox error={error} onRetry={reload} />
          <SearchBar value={q} onChangeText={setQ} placeholder="Search shop, city or owner…" />
        </View>
      }
      ListEmptyComponent={<Empty icon="storefront-outline" title="No shops" body="Shops appear here when sellers set them up." />}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderItem={({ item: s }) => (
        <Pressable style={styles.row} onPress={() => router.push(`/admin/shop/${s.id}`)} role="button">
          {s.logo ? <Image source={{ uri: assetUrl(s.logo) }} style={styles.logo} /> : <View style={[styles.logo, { backgroundColor: colors.accentSoft }]} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
            <Muted style={{ fontSize: 12 }} numberOfLines={1}>{s.owner?.name || 'Unknown owner'} · {s.city || 'No city'}</Muted>
            <Muted style={{ fontSize: 12 }}>
              {s.stats.products} products · {s.stats.arReady} AR · {s.stats.enquiries} enquiries · reply {duration(s.stats.avgResponseMs)}
            </Muted>
            <View style={styles.badges}>
              {s.suspended && <Badge label="Suspended" icon="ban-outline" tone="danger" />}
              {s.stats.new > 0 && <Badge label={`${s.stats.new} awaiting reply`} icon="mail-unread-outline" />}
              {s.stats.open > 0 && s.stats.new === 0 && <Badge label={`${s.stats.open} open`} tone="muted" />}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  logo: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#fff' },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
});
