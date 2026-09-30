import { useState } from 'react';
import { Alert, FlatList, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { assetUrl } from '../../lib/config';
import { hasAr, openInRoom } from '../../lib/ar';
import { callUrl, hasPhone, openLink, whatsappUrl } from '../../lib/contact';
import { dims } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import ModelPreview from '../../components/ModelPreview';
import FitChecker from '../../components/FitChecker';
import ProductCard from '../../components/ProductCard';
import { Button, Card, ErrorBox, H1, H2, Loading, Muted, Screen } from '../../components/ui';
import { colors, radius, space } from '../../theme';

const notify = (title, body) => (Platform.OS === 'web' ? window.alert(`${title}\n${body}`) : Alert.alert(title, body));

export default function ProductDetail() {
  const { id } = useLocalSearchParams();
  const { data, loading, error, reload } = useAsync(() => api.product(id), [id]);
  const [view, setView] = useState('3d');
  const [scaleWarning, setScaleWarning] = useState(false);

  if (loading) return <Loading />;
  if (!data) return <Screen><ErrorBox error={error} onRetry={reload} /></Screen>;

  const { product: p, related } = data;
  const ar = hasAr(p);
  const available = p.stock > 0;
  const shopPhone = p.shop?.phone;
  const shown = ar ? view : 'photo';

  const launchAr = async () => {
    try {
      await openInRoom(p.id);
    } catch {
      notify('Could not open AR', 'Your device could not open the AR viewer.');
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: p.category }} />
      <Screen>
        {shown === '3d' ? (
          <ModelPreview productId={p.id} height={340} onModelSize={(m) => setScaleWarning(m.off)} />
        ) : (
          <Image source={{ uri: assetUrl(p.images?.[0]) }} style={styles.photo} resizeMode="cover" />
        )}

        {ar && (
          <View style={styles.toggle}>
            {[['3d', '3D model', 'cube-outline'], ['photo', 'Photo', 'image-outline']].map(([key, label, icon]) => (
              <Pressable key={key} onPress={() => setView(key)} style={[styles.toggleBtn, shown === key && styles.toggleActive]}>
                <Ionicons name={icon} size={15} color={shown === key ? '#fff' : colors.ink} />
                <Text style={[styles.toggleText, shown === key && { color: '#fff' }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={{ marginTop: space(4) }}>
          <H1>{p.name}</H1>
          {p.shop && (
            <Pressable onPress={() => router.push(`/shop/${p.shop.id}`)} style={styles.shopLink}>
              <Ionicons name="storefront-outline" size={14} color={colors.accent} />
              <Text style={styles.shopLinkText}>{p.shop.name}{p.shop.city ? ` · ${p.shop.city}` : ''}</Text>
            </Pressable>
          )}
          <View style={styles.statusRow}>
            <Text style={styles.onRequest}>Price on request</Text>
            <Text style={[styles.stock, { color: available ? colors.success : colors.warn }]}>
              · {available ? 'Available' : 'Ask about availability'}
            </Text>
          </View>
        </View>

        {ar && (
          <Card style={styles.arCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Ionicons name="scan-outline" size={20} color="#fff" />
              <Text style={styles.arTitle}>See it in your room</Text>
            </View>
            <Text style={styles.arBody}>
              Opens your camera and places the {p.name.toLowerCase()} on your floor at its true size ({dims(p.dimensions)}). Walk around it to check fit, colour and style.
            </Text>
            <Button title="View in your room (AR)" icon="camera-outline" variant="outline" onPress={launchAr}
              style={{ backgroundColor: '#fff', borderColor: '#fff', marginTop: space(3) }} />
            {scaleWarning && (
              <Text style={styles.arWarn}>Note: this 3D model&apos;s size differs from the listed dimensions; trust the listed size.</Text>
            )}
          </Card>
        )}

        <Card style={{ marginTop: space(4) }}>
          <H2 style={{ fontSize: 16 }}>Interested in this piece?</H2>
          <Muted style={{ marginTop: 2 }}>Enquire and {p.shop?.name || 'the shop'} will share the price, availability and delivery details.</Muted>
          <Button title="Enquire now" icon="chatbubble-ellipses-outline" style={{ marginTop: space(3) }}
            onPress={() => router.push(`/enquire/${p.id}`)} />
          {hasPhone(shopPhone) && (
            <View style={styles.contactRow}>
              <Button small variant="outline" title="Call shop" icon="call-outline" style={{ flex: 1 }}
                onPress={() => openLink(callUrl(shopPhone))} />
              <Button small variant="outline" title="WhatsApp" icon="logo-whatsapp" style={{ flex: 1 }}
                onPress={() => openLink(whatsappUrl(shopPhone, `Hi, I'm interested in the ${p.name} I saw on RoomFit. Could you share the price and availability?`))} />
            </View>
          )}
        </Card>

        <Card style={{ marginTop: space(4) }}>
          <H2>Size & details</H2>
          <View style={styles.dimRow}>
            {['width', 'depth', 'height'].map((k) => (
              <View key={k} style={styles.dimBox}>
                <Text style={styles.dimVal}>{p.dimensions[k]}</Text>
                <Muted style={{ fontSize: 12 }}>{k} (cm)</Muted>
              </View>
            ))}
          </View>
          {p.material ? <Detail label="Material" value={p.material} /> : null}
          {p.color ? <Detail label="Colour" value={p.color} /> : null}
          {p.description ? <Muted style={{ marginTop: space(3) }}>{p.description}</Muted> : null}
        </Card>

        <View style={{ marginTop: space(4) }}>
          <FitChecker dimensions={p.dimensions} />
        </View>

        {related?.length > 0 && (
          <View style={{ marginTop: space(6) }}>
            <H2 style={{ marginBottom: space(3) }}>You might also like</H2>
            <FlatList
              horizontal
              data={related}
              keyExtractor={(r) => r.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingBottom: 6 }}
              renderItem={({ item }) => <ProductCard product={item} width={160} />}
            />
          </View>
        )}
      </Screen>
    </>
  );
}

const Detail = ({ label, value }) => (
  <View style={styles.detail}>
    <Muted>{label}</Muted>
    <Text style={styles.detailVal}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  photo: { width: '100%', height: 340, borderRadius: radius.md, backgroundColor: '#fff' },
  toggle: { flexDirection: 'row', alignSelf: 'center', backgroundColor: colors.card, borderRadius: radius.pill, padding: 3, marginTop: space(3), borderWidth: 1, borderColor: colors.border },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill },
  toggleActive: { backgroundColor: colors.ink },
  toggleText: { fontWeight: '600', color: colors.ink, fontSize: 13 },
  shopLink: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  shopLinkText: { color: colors.accent, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: space(2) },
  onRequest: { fontSize: 16, fontWeight: '700', color: colors.ink },
  stock: { fontWeight: '600' },
  arCard: { backgroundColor: colors.accent, borderColor: colors.accent, marginTop: space(4) },
  arTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginLeft: 6 },
  arBody: { color: '#fbeee6', lineHeight: 20 },
  arWarn: { color: '#fff', fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  contactRow: { flexDirection: 'row', gap: 8, marginTop: space(2) },
  dimRow: { flexDirection: 'row', gap: 8, marginTop: space(3) },
  dimBox: { flex: 1, backgroundColor: '#fff', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center', paddingVertical: 10 },
  dimVal: { fontSize: 20, fontWeight: '800', color: colors.ink },
  detail: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space(3) },
  detailVal: { color: colors.ink, fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: 12 },
});
