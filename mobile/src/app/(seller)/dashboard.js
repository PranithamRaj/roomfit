import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { hasPhone } from '../../lib/contact';
import { useAsync } from '../../lib/useAsync';
import { useLiveRefresh } from '../../lib/live';
import { useAuth } from '../../context/AuthContext';
import DemoModeNotice from '../../components/DemoModeNotice';
import { Button, Card, Empty, ErrorBox, H1, H2, LiveBadge, Loading, Muted, Screen } from '../../components/ui';
import { colors, space } from '../../theme';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function Dashboard() {
  const { shop, user } = useAuth();
  const { data, loading, error, reload } = useAsync(async () => {
    if (!shop) return null;
    const [mine, enq] = await Promise.all([api.myShop(), api.enquiries()]);
    const since = Date.now() - WEEK_MS;
    const thisWeek = enq.enquiries.filter((e) => new Date(e.createdAt).getTime() > since).length;
    return { shop: mine.shop, products: mine.products, enquiries: enq.enquiries, thisWeek };
  }, [shop?.id]);
  // New enquiries and AR models added by the RoomFit team appear without a refresh.
  useLiveRefresh(reload, (e) => e.shopId === shop?.id);

  if (!shop) {
    return (
      <Screen>
        <Empty icon="storefront-outline" title={`Welcome, ${user.name.split(' ')[0]}`}
          body="Set up your shop profile, then list your furniture with photos and sizes. The RoomFit team adds 3D models so shoppers can see pieces in their rooms."
          action={<Button title="Set up my shop" onPress={() => router.push('/seller/shop-form')} />} />
      </Screen>
    );
  }
  if (loading) return <Loading />;

  const products = data?.products || [];
  const enquiries = data?.enquiries || [];
  const stats = [
    { icon: 'mail-unread-outline', label: 'New enquiries', value: enquiries.filter((e) => e.status === 'new').length },
    { icon: 'chatbubbles-outline', label: 'In conversation', value: enquiries.filter((e) => e.status === 'contacted').length },
    { icon: 'cube-outline', label: 'Products', value: products.length },
    { icon: 'scan-outline', label: 'AR live', value: products.filter((p) => p.modelUrl).length },
  ];
  const thisWeek = data?.thisWeek || 0;

  // Most-enquired piece, to show what shoppers are interested in.
  const counts = new Map();
  for (const e of enquiries) counts.set(e.productName, (counts.get(e.productName) || 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

  const noPhone = !hasPhone(shop.phone);
  const noPhotos = products.filter((p) => !p.images?.length);
  const unavailable = products.filter((p) => p.stock < 1);
  const arPending = products.length - products.filter((p) => p.modelUrl).length;

  return (
    <Screen refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}>
      <View style={styles.head}>
        <H1 style={{ flex: 1 }}>{shop.name}</H1>
        <LiveBadge />
      </View>
      <Muted>{shop.city}</Muted>
      {data?.shop?.suspended && (
        <Card style={styles.suspended}>
          <H2 style={{ fontSize: 16, color: colors.danger }}>Your shop is hidden from shoppers</H2>
          <Muted style={{ color: colors.danger, marginTop: 4 }}>
            RoomFit has suspended {shop.name}. Your products don&apos;t appear in the catalogue and shoppers can&apos;t send new
            enquiries. You can still reply to existing ones. Contact RoomFit support to resolve this.
          </Muted>
        </Card>
      )}
      <DemoModeNotice style={{ marginTop: space(3) }} />
      <ErrorBox error={error} onRetry={reload} />

      <View style={styles.grid}>
        {stats.map((s) => (
          <Card key={s.label} style={styles.stat}>
            <Ionicons name={s.icon} size={18} color={colors.accent} />
            <Text style={styles.statVal}>{s.value}</Text>
            <Muted style={{ fontSize: 12 }}>{s.label}</Muted>
          </Card>
        ))}
      </View>

      <Card style={{ marginTop: space(3) }}>
        <Muted style={{ fontSize: 12 }}>Enquiries in the last 7 days</Muted>
        <Text style={styles.big}>{thisWeek}</Text>
        <Muted style={{ fontSize: 12, marginTop: 4 }}>
          {top ? `Most asked about: ${top[0]} (${top[1]})` : 'No enquiries yet: clear photos and accurate sizes help shoppers decide.'}
        </Muted>
      </Card>

      {(noPhone || noPhotos.length > 0 || unavailable.length > 0) && (
        <Card style={{ marginTop: space(3) }}>
          <H2 style={{ fontSize: 16, marginBottom: 6 }}>Needs attention</H2>
          {noPhone && <Muted>• Add a phone number to your shop so shoppers can call or WhatsApp you</Muted>}
          {unavailable.map((p) => (
            <Muted key={`s${p.id}`}>• {p.name}: marked unavailable (stock 0)</Muted>
          ))}
          {noPhotos.map((p) => (
            <Muted key={`m${p.id}`}>• {p.name}: add photos so shoppers (and our 3D team) can see it</Muted>
          ))}
        </Card>
      )}

      {arPending > 0 && (
        <Muted style={{ marginTop: space(3), fontSize: 13 }}>
          {arPending === 1 ? '1 piece is' : `${arPending} pieces are`} waiting for a 3D model from the RoomFit team. AR switches on automatically once it&apos;s added.
        </Muted>
      )}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: space(4) }}>
        <Button title="Add product" icon="add" style={{ flex: 1 }} onPress={() => router.push('/seller/product-form')} />
        <Button title="Enquiries" icon="chatbubbles-outline" variant="outline" style={{ flex: 1 }} onPress={() => router.push('/inbox')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  suspended: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft, marginTop: space(3) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: space(4) },
  stat: { flexBasis: '47%', flexGrow: 1, padding: 12 },
  statVal: { fontSize: 24, fontWeight: '800', color: colors.ink, marginTop: 4 },
  big: { fontSize: 26, fontWeight: '800', color: colors.ink, marginTop: 2 },
});
