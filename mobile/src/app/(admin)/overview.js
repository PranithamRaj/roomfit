import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { duration, timeAgo } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { useLiveRefresh } from '../../lib/live';
import ActivityFeed from '../../components/ActivityFeed';
import DemoModeNotice from '../../components/DemoModeNotice';
import { Card, ErrorBox, H2, LiveBadge, Loading, Muted, Screen } from '../../components/ui';
import { colors, radius, space } from '../../theme';

// Everything happening across RoomFit at a glance: KPIs, what needs attention, and the live activity log.
export default function Overview() {
  const { data, loading, error, reload } = useAsync(() => api.adminOverview());
  useLiveRefresh(reload, () => true); // admins receive every event; any of them can move these numbers

  if (loading) return <Loading />;
  const header = (
    <Stack.Screen options={{
      headerRight: () => (
        <Pressable onPress={() => router.push('/admin-account')} style={{ paddingHorizontal: 16 }} accessibilityLabel="Account">
          <Ionicons name="person-circle-outline" size={26} color={colors.ink} />
        </Pressable>
      ),
    }} />
  );
  if (!data) return <Screen>{header}<ErrorBox error={error} onRetry={reload} /></Screen>;

  const { users, shops, products, enquiries: enq, attention, recent } = data;
  const trend = enq.thisWeek - enq.lastWeek;
  const kpis = [
    { icon: 'mail-unread-outline', label: 'Awaiting reply', value: enq.new, tone: enq.new ? colors.accent : undefined, href: '/all-enquiries' },
    { icon: 'chatbubbles-outline', label: 'Enquiries this week', value: enq.thisWeek,
      note: `${trend >= 0 ? '+' : ''}${trend} vs last week · ${enq.today} today`, href: '/all-enquiries' },
    { icon: 'timer-outline', label: 'Avg. first reply', value: duration(enq.avgResponseMs), href: '/shops' },
    { icon: 'people-outline', label: 'Shoppers', value: users.buyers, note: `${users.newThisWeek} new accounts this week`, href: '/users' },
    { icon: 'storefront-outline', label: 'Shops', value: shops.total, note: shops.suspended ? `${shops.suspended} suspended` : `${users.sellers} sellers`, href: '/shops' },
    { icon: 'scan-outline', label: 'AR live', value: `${products.arReady}/${products.total}`, note: 'products with a 3D model', href: '/studio' },
  ];
  const pipeline = [
    ['New', enq.new, colors.accent],
    ['Contacted', enq.contacted, '#2F4A9A'],
    ['Closed', enq.closed, colors.success],
  ];
  const needsAttention = attention.unanswered.length + attention.shopsWithoutPhone.length
    + attention.sellersWithoutShop.length + (attention.productsWithoutModel ? 1 : 0) + (users.suspended ? 1 : 0);

  return (
    <Screen refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}>
      {header}
      <View style={styles.head}>
        <Muted style={{ flex: 1 }}>Everything happening across RoomFit</Muted>
        <LiveBadge />
      </View>
      <DemoModeNotice />
      <ErrorBox error={error} onRetry={reload} />

      <View style={styles.grid}>
        {kpis.map((k) => (
          <Pressable key={k.label} style={styles.kpi} onPress={() => router.push(k.href)} role="button">
            <Ionicons name={k.icon} size={17} color={k.tone || colors.accent} />
            <Text style={[styles.kpiVal, k.tone && { color: k.tone }]}>{k.value}</Text>
            <Text style={styles.kpiLabel}>{k.label}</Text>
            {k.note ? <Muted style={{ fontSize: 11 }}>{k.note}</Muted> : null}
          </Pressable>
        ))}
      </View>

      <Card style={{ marginTop: space(3) }}>
        <Text style={styles.cardTitle}>Enquiry pipeline · {enq.total} total</Text>
        <View style={styles.bar}>
          {pipeline.map(([label, n, color]) => (n ? <View key={label} style={{ flex: n, backgroundColor: color }} /> : null))}
          {!enq.total && <View style={{ flex: 1, backgroundColor: colors.border }} />}
        </View>
        <View style={styles.legend}>
          {pipeline.map(([label, n, color]) => (
            <View key={label} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Muted style={{ fontSize: 12 }}>{label} {n}</Muted>
            </View>
          ))}
        </View>
      </Card>

      <H2 style={styles.section}>Needs attention{needsAttention ? ` (${needsAttention})` : ''}</H2>
      <Card style={{ paddingVertical: 4 }}>
        {!needsAttention && <Muted style={{ paddingVertical: 10 }}>All clear. Nothing needs you right now.</Muted>}
        {attention.unanswered.map((e) => (
          <AttentionRow key={e.id} icon="alarm-outline" danger onPress={() => router.push(`/enquiry/${e.id}`)}
            text={`${e.name} has waited ${timeAgo(e.createdAt).replace(' ago', '')} for ${e.shopName} to reply about ${e.productName}`} />
        ))}
        {attention.shopsWithoutPhone.map((s) => (
          <AttentionRow key={s.id} icon="call-outline" onPress={() => router.push(`/admin/shop/${s.id}`)}
            text={`${s.name} has no phone number, so shoppers can't call or WhatsApp`} />
        ))}
        {attention.sellersWithoutShop.map((u) => (
          <AttentionRow key={u.id} icon="storefront-outline" onPress={() => router.push(`/admin/user/${u.id}`)}
            text={`${u.name} signed up as a seller but hasn't set up a shop`} />
        ))}
        {attention.productsWithoutModel > 0 && (
          <AttentionRow icon="cube-outline" onPress={() => router.push('/studio')}
            text={`${attention.productsWithoutModel} ${attention.productsWithoutModel === 1 ? 'product needs' : 'products need'} a 3D model`} />
        )}
        {users.suspended > 0 && (
          <AttentionRow icon="ban-outline" onPress={() => router.push('/users')}
            text={`${users.suspended} suspended ${users.suspended === 1 ? 'account' : 'accounts'}`} />
        )}
      </Card>

      <View style={styles.sectionRow}>
        <H2>Live activity</H2>
        <Pressable onPress={() => router.push('/admin/activity')}><Text style={styles.link}>See all</Text></Pressable>
      </View>
      <ActivityFeed items={recent} />
    </Screen>
  );
}

function AttentionRow({ icon, text, onPress, danger }) {
  return (
    <Pressable style={styles.attention} onPress={onPress} role="button">
      <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.warn} />
      <Text style={styles.attentionText}>{text}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: space(3) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: { flexBasis: '47%', flexGrow: 1, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12 },
  kpiVal: { fontSize: 24, fontWeight: '800', color: colors.ink, marginTop: 4 },
  kpiLabel: { fontSize: 13, fontWeight: '600', color: colors.ink },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 10, gap: 2 },
  legend: { flexDirection: 'row', gap: 14, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  section: { marginTop: space(6), marginBottom: space(3) },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: space(6), marginBottom: space(3) },
  link: { color: colors.accent, fontWeight: '600' },
  attention: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  attentionText: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 19 },
});
