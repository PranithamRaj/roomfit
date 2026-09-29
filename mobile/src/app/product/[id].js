import { useState } from 'react';
import { Alert, FlatList, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { assetUrl } from '../../lib/config';
import { hasAr, openInRoom } from '../../lib/ar';
import { dims, money } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import ModelPreview from '../../components/ModelPreview';
import FitChecker from '../../components/FitChecker';
import ProductCard from '../../components/ProductCard';
import { Button, Card, ErrorBox, H1, H2, Loading, Muted, QtyStepper, Screen } from '../../components/ui';
import { colors, radius, space } from '../../theme';

const notify = (title, body) => (Platform.OS === 'web' ? window.alert(`${title}\n${body}`) : Alert.alert(title, body));

export default function ProductDetail() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { add } = useCart();
  const { data, loading, error, reload } = useAsync(() => api.product(id), [id]);
  const [view, setView] = useState('3d');
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [scaleWarning, setScaleWarning] = useState(false);

  if (loading) return <Loading />;
  if (!data) return <Screen><ErrorBox error={error} onRetry={reload} /></Screen>;

  const { product: p, related } = data;
  const ar = hasAr(p);
  const soldOut = p.stock < 1;
  const shown = ar ? view : 'photo';

  const addToCart = async () => {
    if (!user) return router.push('/login');
    setAdding(true);
    setActionError(null);
    try {
      await add(p.id, qty);
      notify('Added to cart', `${qty} × ${p.name}`);
    } catch (e) {
      setActionError(e);
    } finally {
      setAdding(false);
    }
  };

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
          <Text style={styles.price}>{money(p.price)}</Text>
          <Text style={[styles.stock, { color: soldOut ? colors.danger : p.stock <= 3 ? colors.warn : colors.success }]}>
            {soldOut ? 'Out of stock' : p.stock <= 3 ? `Only ${p.stock} left` : 'In stock'}
          </Text>
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

        <ErrorBox error={actionError} />
        <View style={styles.buyRow}>
          <QtyStepper value={qty} max={p.stock} onChange={(n) => setQty(Math.max(1, n))} />
          <Button title={soldOut ? 'Sold out' : user ? 'Add to cart' : 'Sign in to buy'} icon="bag-add-outline"
            onPress={addToCart} loading={adding} disabled={soldOut} style={{ flex: 1 }} />
        </View>

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
  price: { fontSize: 24, fontWeight: '800', color: colors.ink, marginTop: space(2) },
  stock: { fontWeight: '600', marginTop: 2 },
  arCard: { backgroundColor: colors.accent, borderColor: colors.accent, marginTop: space(4) },
  arTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginLeft: 6 },
  arBody: { color: '#fbeee6', lineHeight: 20 },
  arWarn: { color: '#fff', fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  buyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: space(4) },
  dimRow: { flexDirection: 'row', gap: 8, marginTop: space(3) },
  dimBox: { flex: 1, backgroundColor: '#fff', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center', paddingVertical: 10 },
  dimVal: { fontSize: 20, fontWeight: '800', color: colors.ink },
  detail: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space(3) },
  detailVal: { color: colors.ink, fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: 12 },
});
