import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../lib/api';
import { assetUrl } from '../../../lib/config';
import { confirmAction } from '../../../lib/confirm';
import { date, duration, timeAgo } from '../../../lib/format';
import { useAsync } from '../../../lib/useAsync';
import { useLiveRefresh } from '../../../lib/live';
import ActivityFeed from '../../../components/ActivityFeed';
import { Badge, Button, Card, ErrorBox, H1, H2, Loading, Muted, Screen, StatusPill } from '../../../components/ui';
import { colors, radius, space } from '../../../theme';

// One shop in full: owner, performance, listings, enquiries and its activity, plus suspension.
export default function AdminShop() {
  const { id } = useLocalSearchParams();
  const { data, loading, error, reload } = useAsync(() => api.adminShop(id), [id]);
  useLiveRefresh(reload, (e) => e.shopId === id || e.type === 'activity.created');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  if (loading) return <Loading />;
  if (!data) return <Screen><ErrorBox error={error} onRetry={reload} /></Screen>;
  const { shop, owner, stats, products, enquiries, activity } = data;

  const toggleSuspended = async () => {
    const suspend = !shop.suspended;
    const ok = await confirmAction(
      suspend ? `Suspend ${shop.name}?` : `Restore ${shop.name}?`,
      suspend
        ? 'Its products disappear from the catalogue and shoppers can no longer enquire. The seller keeps access to their account.'
        : 'Its products return to the catalogue and shoppers can enquire again.',
      suspend ? 'Suspend' : 'Restore',
    );
    if (!ok) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.setShopSuspended(shop.id, suspend);
      await reload();
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(false);
    }
  };

  const figures = [
    ['Products', stats.products],
    ['AR live', stats.arReady],
    ['Enquiries', stats.enquiries],
    ['Awaiting reply', stats.new],
    ['Open', stats.open],
    ['Avg. first reply', duration(stats.avgResponseMs)],
  ];

  return (
    <>
      <Stack.Screen options={{ title: shop.name }} />
      <Screen>
        {shop.coverImage ? <Image source={{ uri: assetUrl(shop.coverImage) }} style={styles.cover} /> : null}
        <View style={styles.head}>
          {shop.logo ? <Image source={{ uri: assetUrl(shop.logo) }} style={styles.logo} /> : null}
          <View style={{ flex: 1 }}>
            <H1 style={{ fontSize: 22 }}>{shop.name}</H1>
            <Muted>{[shop.address, shop.city].filter(Boolean).join(', ') || 'No address'}</Muted>
            <Muted>{shop.phone || 'No phone number'} · since {date(shop.createdAt)}</Muted>
          </View>
        </View>
        {shop.suspended && (
          <View style={styles.suspended}>
            <Ionicons name="ban-outline" size={18} color={colors.danger} />
            <Text style={styles.suspendedText}>Suspended: hidden from shoppers and not taking enquiries.</Text>
          </View>
        )}

        {owner && (
          <Pressable style={styles.owner} onPress={() => router.push(`/admin/user/${owner.id}`)} role="button">
            <Ionicons name="person-circle-outline" size={28} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.ownerName}>{owner.name}</Text>
              <Muted style={{ fontSize: 12 }}>{owner.email}</Muted>
            </View>
            {owner.suspended && <Badge label="Account suspended" tone="danger" />}
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>
        )}

        <View style={styles.grid}>
          {figures.map(([label, value]) => (
            <Card key={label} style={styles.figure}>
              <Text style={styles.figureVal}>{value}</Text>
              <Muted style={{ fontSize: 12 }}>{label}</Muted>
            </Card>
          ))}
        </View>
        {stats.lastEnquiryAt && <Muted style={{ marginTop: 6, fontSize: 12 }}>Last enquiry {timeAgo(stats.lastEnquiryAt)}</Muted>}

        <H2 style={styles.section}>Enquiries ({enquiries.length})</H2>
        {enquiries.length ? (
          <Card style={{ paddingVertical: 4 }}>
            {enquiries.map((e, i) => (
              <Pressable key={e.id} style={[styles.line, i > 0 && styles.divider]} onPress={() => router.push(`/enquiry/${e.id}`)} role="button">
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineTitle} numberOfLines={1}>{e.name} · {e.productName}</Text>
                  <Muted style={{ fontSize: 12 }}>{timeAgo(e.createdAt)}</Muted>
                </View>
                <StatusPill status={e.status} />
              </Pressable>
            ))}
          </Card>
        ) : <Muted>No enquiries yet.</Muted>}

        <H2 style={styles.section}>Products ({products.length})</H2>
        {products.length ? (
          <Card style={{ paddingVertical: 4 }}>
            {products.map((p, i) => (
              <Pressable key={p.id} style={[styles.line, i > 0 && styles.divider]}
                onPress={() => router.push({ pathname: '/admin/ar-model', params: { id: p.id } })} role="button">
                {p.images?.[0] ? <Image source={{ uri: assetUrl(p.images[0]) }} style={styles.thumb} /> : <View style={[styles.thumb, { backgroundColor: colors.accentSoft }]} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineTitle} numberOfLines={1}>{p.name}</Text>
                  <Muted style={{ fontSize: 12 }}>{p.category} · {p.stock} in stock · {p.images?.length || 0} photos</Muted>
                </View>
                {p.modelUrl ? <Badge label="AR live" tone="success" /> : <Badge label="No 3D" tone="muted" />}
              </Pressable>
            ))}
          </Card>
        ) : <Muted>No products listed.</Muted>}

        <H2 style={styles.section}>Activity</H2>
        <ActivityFeed items={activity} empty="No activity recorded for this shop yet." />

        <View style={{ marginTop: space(6) }}>
          <ErrorBox error={actionError} />
          <Button title={shop.suspended ? 'Restore shop' : 'Suspend shop'} icon={shop.suspended ? 'refresh-outline' : 'ban-outline'}
            variant={shop.suspended ? 'primary' : 'danger'} loading={busy} onPress={toggleSuspended} />
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', height: 130, borderRadius: radius.md, backgroundColor: '#fff', marginBottom: space(3) },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 56, height: 56, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  suspended: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: space(3), marginTop: space(3) },
  suspendedText: { flex: 1, color: colors.danger, fontWeight: '600' },
  owner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12, marginTop: space(3) },
  ownerName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space(3) },
  figure: { flexBasis: '31%', flexGrow: 1, padding: 10 },
  figureVal: { fontSize: 18, fontWeight: '800', color: colors.ink },
  section: { marginTop: space(6), marginBottom: space(3) },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  lineTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  thumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#fff' },
});
