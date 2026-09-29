import { useState } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { assetUrl } from '../../lib/config';
import { openInRoom } from '../../lib/ar';
import { useAsync } from '../../lib/useAsync';
import { goBack } from '../../lib/nav';
import { Button, Card, Chip, ErrorBox, Field, H2, Loading, Muted, Screen } from '../../components/ui';
import { colors, radius, space } from '../../theme';

const EMPTY = {
  name: '', category: '', price: '', stock: '1', material: '', color: '', description: '',
  width: '', depth: '', height: '', placement: 'floor', modelUrl: '', iosModelUrl: '', images: [],
};

const confirm = (title, body) =>
  Platform.OS === 'web'
    ? Promise.resolve(window.confirm(`${title}\n${body}`))
    : new Promise((resolve) =>
        Alert.alert(title, body, [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
        ]));

const toForm = (p) => ({
  ...EMPTY,
  ...p,
  price: String(p.price),
  stock: String(p.stock),
  width: String(p.dimensions.width),
  depth: String(p.dimensions.depth),
  height: String(p.dimensions.height),
  images: p.images || [],
});

// Loads the product (when editing), then mounts the editor with it as initial state.
export default function ProductForm() {
  const { id } = useLocalSearchParams();
  const existing = useAsync(() => (id ? api.product(id).then((r) => r.product) : Promise.resolve(null)), [id]);
  if (existing.loading) return <Loading />;
  if (id && !existing.data) return <Screen><ErrorBox error={existing.error} onRetry={existing.reload} /></Screen>;
  return <ProductEditor key={id || 'new'} id={id} product={existing.data} />;
}

function ProductEditor({ id, product }) {
  const editing = Boolean(id);
  const [form, setForm] = useState(() => (product ? toForm(product) : EMPTY));
  const [imageUrl, setImageUrl] = useState('');
  const [busy, setBusy] = useState(null); // 'save' | 'delete' | 'image' | 'model' | 'ios'
  const [error, setError] = useState(null);

  const categories = useAsync(() => api.categories().then((r) => r.categories));

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const num = (k) => (v) => set(k)(v.replace(/[^0-9.]/g, ''));

  const uploadWith = async (kind, pick) => {
    setError(null);
    try {
      const res = await pick();
      if (res.canceled || !res.assets?.length) return null;
      setBusy(kind);
      const { url } = await api.upload(res.assets[0]);
      return url;
    } catch (e) {
      setError(e);
      return null;
    } finally {
      setBusy(null);
    }
  };

  const addPhoto = async () => {
    const url = await uploadWith('image', () => ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 }));
    if (url) setForm((f) => ({ ...f, images: [...f.images, url] }));
  };

  const pickModel = async (field) => {
    const url = await uploadWith(field === 'modelUrl' ? 'model' : 'ios', () =>
      DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true }));
    if (!url) return;
    const want = field === 'modelUrl' ? '.glb' : '.usdz';
    if (!url.toLowerCase().endsWith(want)) return setError(new Error(`Please choose a ${want} file`));
    set(field)(url);
  };

  const save = async () => {
    setError(null);
    setBusy('save');
    const payload = {
      name: form.name,
      category: form.category,
      price: Number(form.price),
      stock: Number(form.stock || 0),
      material: form.material,
      color: form.color,
      description: form.description,
      placement: form.placement,
      modelUrl: form.modelUrl,
      iosModelUrl: form.iosModelUrl,
      images: form.images,
      dimensions: { width: Number(form.width), depth: Number(form.depth), height: Number(form.height) },
    };
    try {
      if (editing) await api.updateProduct(id, payload);
      else await api.createProduct(payload);
      goBack('/products');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!(await confirm('Delete product?', `${form.name} will be removed from your shop.`))) return;
    setBusy('delete');
    try {
      await api.deleteProduct(id);
      goBack('/products');
    } catch (e) {
      setError(e);
      setBusy(null);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: editing ? 'Edit product' : 'New product' }} />
      <Screen>
        <H2 style={styles.section}>Basics</H2>
        <Field label="Name" value={form.name} onChangeText={set('name')} placeholder="e.g. Oslo 3-seater sofa" />
        <Text style={styles.label}>Category</Text>
        <View style={styles.wrap}>
          {(categories.data || []).map((c) => (
            <Chip key={c} label={c} active={form.category === c} onPress={() => set('category')(c)} />
          ))}
        </View>
        <View style={styles.pair}>
          <Field style={{ flex: 1 }} label="Price (₹)" value={form.price} onChangeText={num('price')} keyboardType="decimal-pad" />
          <Field style={{ flex: 1 }} label="Stock" value={form.stock} onChangeText={(v) => set('stock')(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />
        </View>
        <View style={styles.pair}>
          <Field style={{ flex: 1 }} label="Material" value={form.material} onChangeText={set('material')} />
          <Field style={{ flex: 1 }} label="Colour" value={form.color} onChangeText={set('color')} />
        </View>
        <Field label="Description" value={form.description} onChangeText={set('description')} multiline />

        <H2 style={styles.section}>Real-world size</H2>
        <Muted style={{ marginBottom: 8 }}>Shoppers use these to check the fit. Measure the widest points, in centimetres.</Muted>
        <View style={styles.pair}>
          <Field style={{ flex: 1 }} label="Width" value={form.width} onChangeText={num('width')} keyboardType="decimal-pad" />
          <Field style={{ flex: 1 }} label="Depth" value={form.depth} onChangeText={num('depth')} keyboardType="decimal-pad" />
          <Field style={{ flex: 1 }} label="Height" value={form.height} onChangeText={num('height')} keyboardType="decimal-pad" />
        </View>

        <H2 style={styles.section}>Photos</H2>
        <View style={styles.wrap}>
          {form.images.map((url) => (
            <View key={url} style={styles.photoWrap}>
              <Image source={{ uri: assetUrl(url) }} style={styles.photo} />
              <Pressable style={styles.photoX} onPress={() => setForm((f) => ({ ...f, images: f.images.filter((u) => u !== url) }))}
                accessibilityLabel="Remove photo">
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
            </View>
          ))}
          <Pressable style={[styles.photo, styles.addPhoto]} onPress={addPhoto} disabled={busy === 'image'}>
            <Ionicons name={busy === 'image' ? 'hourglass-outline' : 'camera-outline'} size={22} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 12 }}>Add</Text>
          </Pressable>
        </View>
        <View style={[styles.pair, { alignItems: 'flex-end' }]}>
          <Field style={{ flex: 1, marginBottom: 0 }} label="…or paste an image URL" value={imageUrl} onChangeText={setImageUrl} autoCapitalize="none" />
          <Button small variant="outline" title="Add" disabled={!imageUrl.trim()}
            onPress={() => { setForm((f) => ({ ...f, images: [...f.images, imageUrl.trim()] })); setImageUrl(''); }} />
        </View>

        <H2 style={styles.section}>3D model & AR</H2>
        <Card>
          <Muted style={{ marginBottom: 10 }}>
            Upload a .glb model built to real-world scale (1 unit = 1 metre). It powers the 3D viewer and true-size AR on Android and iOS
            (iOS converts it automatically; add a .usdz for best quality).
          </Muted>
          <Field label="GLB model URL" value={form.modelUrl} onChangeText={set('modelUrl')} autoCapitalize="none" placeholder="https://…/sofa.glb" />
          <Button small variant="outline" icon="cloud-upload-outline" title="Upload .glb file" loading={busy === 'model'} onPress={() => pickModel('modelUrl')} />
          <Field style={{ marginTop: space(3) }} label="USDZ model URL (optional, iOS)" value={form.iosModelUrl} onChangeText={set('iosModelUrl')} autoCapitalize="none" />
          <Button small variant="outline" icon="cloud-upload-outline" title="Upload .usdz file" loading={busy === 'ios'} onPress={() => pickModel('iosModelUrl')} />

          <Text style={[styles.label, { marginTop: space(4) }]}>Place in AR on the</Text>
          <View style={styles.wrap}>
            <Chip label="Floor" icon="square-outline" active={form.placement === 'floor'} onPress={() => set('placement')('floor')} />
            <Chip label="Wall" icon="tablet-landscape-outline" active={form.placement === 'wall'} onPress={() => set('placement')('wall')} />
          </View>
          {editing && product?.modelUrl ? (
            <Button small variant="dark" icon="scan-outline" title="Test saved model in AR" onPress={() => openInRoom(id)} />
          ) : null}
        </Card>

        <View style={{ marginTop: space(5) }}>
          <ErrorBox error={error} />
          <Button title={editing ? 'Save changes' : 'Publish product'} onPress={save} loading={busy === 'save'} disabled={!!busy && busy !== 'save'} />
          {editing && <Button title="Delete product" variant="danger" style={{ marginTop: 10 }} onPress={remove} loading={busy === 'delete'} />}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space(5), marginBottom: space(3) },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space(2) },
  pair: { flexDirection: 'row', gap: 8 },
  photoWrap: { position: 'relative' },
  photo: { width: 76, height: 76, borderRadius: radius.sm, backgroundColor: '#fff' },
  photoX: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  addPhoto: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
