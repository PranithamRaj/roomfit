import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { useLiveRefresh } from '../../lib/live';
import { goBack } from '../../lib/nav';
import PhotoUploader, { usePhotoUploads } from '../../components/PhotoUploader';
import { Button, Card, Chip, ErrorBox, Field, H2, Loading, Muted, Screen } from '../../components/ui';
import { colors, space } from '../../theme';

const EMPTY = {
  name: '', category: '', stock: '1', material: '', color: '', description: '',
  width: '', depth: '', height: '', images: [],
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
  stock: String(p.stock),
  width: String(p.dimensions.width),
  depth: String(p.dimensions.depth),
  height: String(p.dimensions.height),
  images: p.images || [],
});

// Loads the product (when editing), then mounts the editor with it as initial state.
// The product stays live so the AR status updates as soon as the RoomFit team adds a model.
export default function ProductForm() {
  const { id } = useLocalSearchParams();
  const existing = useAsync(() => (id ? api.product(id).then((r) => r.product) : Promise.resolve(null)), [id]);
  useLiveRefresh(existing.reload, (e) => Boolean(id) && e.productId === id);
  if (existing.loading) return <Loading />;
  if (id && !existing.data) return <Screen><ErrorBox error={existing.error} onRetry={existing.reload} /></Screen>;
  return <ProductEditor key={id || 'new'} id={id} product={existing.data} />;
}

function ProductEditor({ id, product }) {
  const editing = Boolean(id);
  const [form, setForm] = useState(() => (product ? toForm(product) : EMPTY));
  const [imageUrl, setImageUrl] = useState('');
  const [busy, setBusy] = useState(null); // 'save' | 'delete' | a photo url being removed
  const [error, setError] = useState(null);

  const categories = useAsync(() => api.categories().then((r) => r.categories));

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const num = (k) => (v) => set(k)(v.replace(/[^0-9.]/g, ''));

  // On a published product each photo goes live the moment it finishes uploading;
  // on a new one, photos are attached when it's published.
  const addImage = async (url) => {
    if (editing) await api.addProductImage(id, url);
    setForm((f) => (f.images.includes(url) ? f : { ...f, images: [...f.images, url] }));
  };
  const removeImage = async (url) => {
    setError(null);
    setBusy(url);
    try {
      if (editing) await api.removeProductImage(id, url);
      setForm((f) => ({ ...f, images: f.images.filter((u) => u !== url) }));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };
  const photos = usePhotoUploads(addImage, { count: form.images.length });

  const addImageUrl = async () => {
    setError(null);
    try {
      await addImage(imageUrl.trim());
      setImageUrl('');
    } catch (e) {
      setError(e);
    }
  };

  const save = async () => {
    setError(null);
    setBusy('save');
    const payload = {
      name: form.name,
      category: form.category,
      stock: Number(form.stock || 0),
      material: form.material,
      color: form.color,
      description: form.description,
      dimensions: { width: Number(form.width), depth: Number(form.depth), height: Number(form.height) },
    };
    try {
      // Photos of a published product are already saved one by one.
      if (editing) await api.updateProduct(id, payload);
      else await api.createProduct({ ...payload, images: form.images });
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

  const arLive = Boolean(product?.modelUrl);

  return (
    <>
      <Stack.Screen options={{ title: editing ? 'Edit product' : 'New product' }} />
      <Screen>
        <H2 style={[styles.section, { marginTop: 0 }]}>Photos</H2>
        <Muted style={{ marginBottom: 10 }}>
          {editing
            ? 'Photos go live on your listing as soon as they finish uploading. The first photo is the cover.'
            : 'Photos upload straight away and go live when you publish. The first photo is the cover.'}
        </Muted>
        <PhotoUploader images={form.images} photos={photos} onRemove={removeImage} removing={busy} />
        <View style={[styles.pair, { alignItems: 'flex-end', marginTop: space(3) }]}>
          <Field style={{ flex: 1, marginBottom: 0 }} label="…or paste an image URL" value={imageUrl} onChangeText={setImageUrl} autoCapitalize="none" />
          <Button small variant="outline" title="Add" disabled={!imageUrl.trim()} onPress={addImageUrl} />
        </View>

        <H2 style={styles.section}>Basics</H2>
        <Field label="Name" value={form.name} onChangeText={set('name')} placeholder="e.g. Oslo 3-seater sofa" />
        <Text style={styles.label}>Category</Text>
        <View style={styles.wrap}>
          {(categories.data || []).map((c) => (
            <Chip key={c} label={c} active={form.category === c} onPress={() => set('category')(c)} />
          ))}
        </View>
        <Field label="Stock" value={form.stock} onChangeText={(v) => set('stock')(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad"
          hint={"0 shows the piece as 'Ask about availability'"} />
        <View style={styles.pair}>
          <Field style={{ flex: 1 }} label="Material" value={form.material} onChangeText={set('material')} />
          <Field style={{ flex: 1 }} label="Colour" value={form.color} onChangeText={set('color')} />
        </View>
        <Field label="Description" value={form.description} onChangeText={set('description')} multiline />

        <H2 style={styles.section}>Real-world size</H2>
        <Muted style={{ marginBottom: 8 }}>Shoppers use these to check the fit, and they set the size of the piece in AR. Measure the widest points, in centimetres.</Muted>
        <View style={styles.pair}>
          <Field style={{ flex: 1 }} label="Width" value={form.width} onChangeText={num('width')} keyboardType="decimal-pad" />
          <Field style={{ flex: 1 }} label="Depth" value={form.depth} onChangeText={num('depth')} keyboardType="decimal-pad" />
          <Field style={{ flex: 1 }} label="Height" value={form.height} onChangeText={num('height')} keyboardType="decimal-pad" />
        </View>

        <Card style={[styles.arCard, arLive && { borderColor: colors.success }]}>
          <Ionicons name={arLive ? 'cube' : 'time-outline'} size={22} color={arLive ? colors.success : colors.muted} />
          <View style={{ flex: 1 }}>
            <Text style={styles.arTitle}>{arLive ? 'AR is live for this piece' : 'AR view: added by RoomFit'}</Text>
            <Muted style={{ fontSize: 13 }}>
              {arLive
                ? 'Shoppers can place it in their room at its true size.'
                : 'Our team builds the 3D model from your photos and measurements. Clear photos from several angles help.'}
            </Muted>
          </View>
        </Card>

        <View style={{ marginTop: space(5) }}>
          <ErrorBox error={error} />
          {photos.uploading && <Muted style={{ textAlign: 'center', marginBottom: 8 }}>Waiting for photos to finish uploading…</Muted>}
          <Button title={editing ? 'Save changes' : 'Publish product'} onPress={save} loading={busy === 'save'}
            disabled={photos.uploading || (!!busy && busy !== 'save')} />
          {editing && <Button title="Delete product" variant="danger" style={{ marginTop: 10 }} onPress={remove} loading={busy === 'delete'} />}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space(5), marginBottom: space(2) },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space(2) },
  pair: { flexDirection: 'row', gap: 8 },
  arCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: space(3) },
  arTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 2 },
});
