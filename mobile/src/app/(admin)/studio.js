import { useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { assetUrl } from '../../lib/config';
import { useAsync } from '../../lib/useAsync';
import { useLiveRefresh } from '../../lib/live';
import DemoModeNotice from '../../components/DemoModeNotice';
import { Badge, Card, Chip, Empty, ErrorBox, LiveBadge, Loading, Muted } from '../../components/ui';
import { colors, radius, space } from '../../theme';

const FILTERS = [
  { key: 'missing', label: 'Needs a model' },
  { key: 'ready', label: 'AR live' },
  { key: 'all', label: 'All' },
];

// Every shop's products; the ones still waiting for a 3D model come first.
export default function ArStudio() {
  const [filter, setFilter] = useState('missing');
  const { data, loading, error, reload } = useAsync(
    () => api.adminProducts({ ar: filter === 'all' ? undefined : filter }),
    [filter],
  );
  // Products that sellers add or edit show up here straight away.
  useLiveRefresh(reload, (e) => e.type.startsWith('product.'));

  if (loading) return <Loading />;
  const stats = data?.stats || { total: 0, missing: 0, arReady: 0 };

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space(4), paddingBottom: space(10) }}
      data={data?.products || []}
      keyExtractor={(p) => p.id}
      refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
      ListHeaderComponent={
        <View style={{ marginBottom: space(3) }}>
          <DemoModeNotice />
          <ErrorBox error={error} onRetry={reload} />
          <View style={styles.stats}>
            {[
              ['Products', stats.total, 'cube-outline'],
              ['Need a model', stats.missing, 'time-outline'],
              ['AR live', stats.arReady, 'scan-outline'],
            ].map(([label, value, icon]) => (
              <Card key={label} style={styles.stat}>
                <Ionicons name={icon} size={16} color={colors.accent} />
                <Text style={styles.statVal}>{value}</Text>
                <Muted style={{ fontSize: 12 }}>{label}</Muted>
              </Card>
            ))}
          </View>
          <LiveBadge style={{ marginTop: space(3), marginBottom: space(2) }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {FILTERS.map((f) => (
              <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
            ))}
          </ScrollView>
        </View>
      }
      ListEmptyComponent={
        <Empty icon="checkmark-done-outline" title={filter === 'missing' ? 'All caught up' : 'Nothing here'}
          body={filter === 'missing' ? 'Every product has a 3D model. New listings from sellers appear here automatically.' : undefined} />
      }
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderItem={({ item: p }) => (
        <Pressable style={styles.row} onPress={() => router.push({ pathname: '/admin/ar-model', params: { id: p.id } })} role="button">
          {p.images?.[0] ? (
            <Image source={{ uri: assetUrl(p.images[0]) }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, { backgroundColor: colors.accentSoft }]} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
            <Muted style={{ fontSize: 12 }} numberOfLines={1}>{p.shop?.name} · {p.category}</Muted>
            <Muted style={{ fontSize: 12 }}>{p.dimensions.width}×{p.dimensions.depth}×{p.dimensions.height} cm · {p.images?.length || 0} photos</Muted>
            <View style={{ marginTop: 6 }}>
              {p.modelUrl
                ? <Badge label={`AR live · ${p.placement === 'wall' ? 'wall' : 'floor'}`} icon="cube-outline" tone="success" />
                : <Badge label="Needs a 3D model" icon="time-outline" />}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, padding: 12 },
  statVal: { fontSize: 22, fontWeight: '800', color: colors.ink, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: '#fff' },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
});
