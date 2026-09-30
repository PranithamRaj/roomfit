import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { ROLE_LABEL, date } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { useLiveRefresh } from '../../lib/live';
import { Badge, Chip, Empty, ErrorBox, Loading, Muted, SearchBar } from '../../components/ui';
import { colors, radius, space } from '../../theme';

const ROLES = [
  { key: '', label: 'Everyone' },
  { key: 'buyer', label: 'Shoppers' },
  { key: 'seller', label: 'Sellers' },
  { key: 'admin', label: 'Admins' },
];

// Every account, newest first.
export default function Users() {
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useAsync(() => api.adminUsers({ role }).then((r) => r.users), [role]);
  useLiveRefresh(reload, (e) => e.type === 'activity.created');

  if (loading) return <Loading />;
  const term = q.trim().toLowerCase();
  const shown = (data || []).filter((u) => !term || `${u.name} ${u.email} ${u.shop?.name || ''}`.toLowerCase().includes(term));

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space(4), paddingBottom: space(10) }}
      data={shown}
      keyExtractor={(u) => u.id}
      refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ marginBottom: space(3) }}>
          <ErrorBox error={error} onRetry={reload} />
          <SearchBar value={q} onChangeText={setQ} placeholder="Search name, email or shop…" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            {ROLES.map((r) => <Chip key={r.key} label={r.label} active={role === r.key} onPress={() => setRole(r.key)} />)}
          </ScrollView>
          <Muted style={{ fontSize: 13 }}>{shown.length} {shown.length === 1 ? 'account' : 'accounts'}</Muted>
        </View>
      }
      ListEmptyComponent={<Empty icon="people-outline" title="No accounts" />}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderItem={({ item: u }) => (
        <Pressable style={styles.row} onPress={() => router.push(`/admin/user/${u.id}`)} role="button">
          <View style={[styles.avatar, u.suspended && { backgroundColor: colors.muted }]}>
            <Text style={styles.avatarText}>{u.name[0]?.toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{u.name}</Text>
            <Muted style={{ fontSize: 12 }} numberOfLines={1}>{u.email}</Muted>
            <Muted style={{ fontSize: 12 }} numberOfLines={1}>
              {u.role === 'seller' ? (u.shop ? u.shop.name : 'No shop yet') : u.role === 'buyer' ? `${u.enquiries} enquiries` : 'RoomFit team'}
              {' · joined '}{date(u.createdAt)}
            </Muted>
            <View style={styles.badges}>
              <Badge label={ROLE_LABEL[u.role]} tone={u.role === 'admin' ? 'dark' : u.role === 'seller' ? 'accent' : 'muted'} />
              {u.suspended && <Badge label="Suspended" icon="ban-outline" tone="danger" />}
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
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
});
