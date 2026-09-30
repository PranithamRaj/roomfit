import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../lib/api';
import { confirmAction } from '../../../lib/confirm';
import { ROLE_LABEL, date, duration, timeAgo } from '../../../lib/format';
import { useAsync } from '../../../lib/useAsync';
import { useLiveRefresh } from '../../../lib/live';
import ActivityFeed from '../../../components/ActivityFeed';
import { Badge, Button, Card, ErrorBox, H2, Loading, Muted, Screen, StatusPill } from '../../../components/ui';
import { colors, radius, space } from '../../../theme';

// One account in full: profile, their shop or the enquiries they sent, their activity, plus suspension.
export default function AdminUser() {
  const { id } = useLocalSearchParams();
  const { data, loading, error, reload } = useAsync(() => api.adminUser(id), [id]);
  useLiveRefresh(reload, (e) => e.type === 'activity.created' || e.type.startsWith('enquiry.'));
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  if (loading) return <Loading />;
  if (!data) return <Screen><ErrorBox error={error} onRetry={reload} /></Screen>;
  const { user, shop, enquiries, activity } = data;

  const toggleSuspended = async () => {
    const suspend = !user.suspended;
    const ok = await confirmAction(
      suspend ? `Suspend ${user.name}?` : `Restore ${user.name}?`,
      suspend
        ? "They're signed out everywhere and can't sign in again until you restore the account. Their data is kept."
        : 'They can sign in again.',
      suspend ? 'Suspend' : 'Restore',
    );
    if (!ok) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.setUserSuspended(user.id, suspend);
      await reload();
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: user.name }} />
      <Screen>
        <Card style={styles.profile}>
          <View style={[styles.avatar, user.suspended && { backgroundColor: colors.muted }]}>
            <Text style={styles.avatarText}>{user.name[0]?.toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <H2>{user.name}</H2>
            <Muted>{user.email}</Muted>
            <Muted style={{ fontSize: 12 }}>Joined {date(user.createdAt)}</Muted>
            <View style={styles.badges}>
              <Badge label={ROLE_LABEL[user.role]} tone={user.role === 'admin' ? 'dark' : user.role === 'seller' ? 'accent' : 'muted'} />
              {user.suspended && <Badge label="Suspended" icon="ban-outline" tone="danger" />}
            </View>
          </View>
        </Card>

        {user.role === 'seller' && (
          <>
            <H2 style={styles.section}>Shop</H2>
            {shop ? (
              <Pressable style={styles.link} onPress={() => router.push(`/admin/shop/${shop.id}`)} role="button">
                <Ionicons name="storefront-outline" size={22} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.linkTitle}>{shop.name}{shop.suspended ? ' (suspended)' : ''}</Text>
                  <Muted style={{ fontSize: 12 }}>
                    {shop.stats.products} products · {shop.stats.enquiries} enquiries · {shop.stats.new} awaiting reply · reply {duration(shop.stats.avgResponseMs)}
                  </Muted>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </Pressable>
            ) : <Muted>Hasn&apos;t set up a shop yet.</Muted>}
          </>
        )}

        {user.role === 'buyer' && (
          <>
            <H2 style={styles.section}>Enquiries sent ({enquiries.length})</H2>
            {enquiries.length ? (
              <Card style={{ paddingVertical: 4 }}>
                {enquiries.map((e, i) => (
                  <Pressable key={e.id} style={[styles.line, i > 0 && styles.divider]} onPress={() => router.push(`/enquiry/${e.id}`)} role="button">
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lineTitle} numberOfLines={1}>{e.productName} · {e.shopName}</Text>
                      <Muted style={{ fontSize: 12 }}>{timeAgo(e.createdAt)}</Muted>
                    </View>
                    <StatusPill status={e.status} />
                  </Pressable>
                ))}
              </Card>
            ) : <Muted>No enquiries sent while signed in.</Muted>}
          </>
        )}

        <H2 style={styles.section}>Activity</H2>
        <ActivityFeed items={activity} empty="No activity recorded for this account yet." />

        {user.role !== 'admin' && (
          <View style={{ marginTop: space(6) }}>
            <ErrorBox error={actionError} />
            <Button title={user.suspended ? 'Restore account' : 'Suspend account'} icon={user.suspended ? 'refresh-outline' : 'ban-outline'}
              variant={user.suspended ? 'primary' : 'danger'} loading={busy} onPress={toggleSuspended} />
          </View>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  section: { marginTop: space(6), marginBottom: space(3) },
  link: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12 },
  linkTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  lineTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
});
