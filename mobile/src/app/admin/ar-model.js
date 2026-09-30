import { useState } from 'react';
import { Alert, FlatList, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { assetUrl } from '../../lib/config';
import { openInRoom } from '../../lib/ar';
import { dims } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { useLiveRefresh } from '../../lib/live';
import ModelPreview from '../../components/ModelPreview';
import { Badge, Button, Card, Chip, ErrorBox, Field, H1, H2, Loading, Muted, Screen } from '../../components/ui';
import { colors, radius, space } from '../../theme';

const confirm = (title, body) =>
  Platform.OS === 'web'
    ? Promise.resolve(window.confirm(`${title}\n${body}`))
    : new Promise((resolve) =>
        Alert.alert(title, body, [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Remove', style: 'destructive', onPress: () => resolve(true) },
        ]));

const toForm = (p) => ({ modelUrl: p.modelUrl || '', iosModelUrl: p.iosModelUrl || '', placement: p.placement || 'floor' });

// Admin: attach, replace or remove a product's 3D model. Shoppers see the change immediately.
export default function ArModel() {
  const { id } = useLocalSearchParams();
  const product = useAsync(() => api.product(id).then((r) => r.product), [id]);
  // Keeps photos and sizes current if the seller edits the listing meanwhile.
  useLiveRefresh(product.reload, (e) => e.productId === id);
  if (product.loading) return <Loading />;
  if (!product.data) return <Screen><ErrorBox error={product.error} onRetry={product.reload} /></Screen>;
  return <ModelEditor key={id} product={product.data} reload={product.reload} />;
}

function ModelEditor({ product: p, reload }) {
  const [form, setForm] = useState(() => toForm(p));
  const [upload, setUpload] = useState(null); // { field, progress }
  const [busy, setBusy] = useState(null); // 'save' | 'remove'
  const [error, setError] = useState(null);
  const [measured, setMeasured] = useState(null); // size of the saved model, from the viewer

  const saved = toForm(p);
  const dirty = Object.keys(saved).some((k) => saved[k] !== form[k]);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const pickModel = async (field) => {
    const ext = field === 'modelUrl' ? '.glb' : '.usdz';
    setError(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      if (!String(asset.name || asset.uri).toLowerCase().endsWith(ext)) throw new Error(`Please choose a ${ext} file`);
      setUpload({ field, progress: 0 });
      const { url } = await api.upload(asset, { onProgress: (progress) => setUpload({ field, progress }) });
      set(field)(url);
    } catch (e) {
      setError(e);
    } finally {
      setUpload(null);
    }
  };

  const save = async (data, kind) => {
    setError(null);
    setBusy(kind);
    try {
      const { product } = await api.setProductAr(p.id, data);
      setForm(toForm(product));
      setMeasured(null);
      await reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!(await confirm('Remove 3D model?', `Shoppers will no longer be able to view ${p.name} in AR.`))) return;
    save({ modelUrl: '', iosModelUrl: '' }, 'remove');
  };

  const uploadButton = (field, label) => (
    <Button small variant="outline" icon="cloud-upload-outline"
      title={upload?.field === field ? `Uploading… ${Math.round(upload.progress * 100)}%` : label}
      disabled={!!upload || !!busy} onPress={() => pickModel(field)} />
  );

  return (
    <>
      <Stack.Screen options={{ title: p.modelUrl ? 'Edit 3D model' : 'Add 3D model' }} />
      <Screen>
        <H1 style={{ fontSize: 22 }}>{p.name}</H1>
        <Muted>{p.shop?.name} · {p.category}</Muted>
        <View style={{ marginTop: 6 }}>
          {p.modelUrl ? <Badge label="AR live" icon="cube-outline" tone="success" /> : <Badge label="Needs a 3D model" icon="time-outline" />}
        </View>

        <H2 style={styles.section}>Seller&apos;s reference</H2>
        {p.images?.length ? (
          <FlatList
            horizontal
            data={p.images}
            keyExtractor={(u) => u}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
            renderItem={({ item }) => <Image source={{ uri: assetUrl(item) }} style={styles.photo} />}
          />
        ) : (
          <Muted>No photos yet.</Muted>
        )}
        <Card style={{ marginTop: space(3) }}>
          <Text style={styles.size}>{dims(p.dimensions)}</Text>
          <Muted style={{ fontSize: 13 }}>Build the model to exactly this size, in metres (1 unit = 1 m), with its origin on the floor.</Muted>
          {p.material || p.color ? <Muted style={{ fontSize: 13, marginTop: 6 }}>{[p.material, p.color].filter(Boolean).join(' · ')}</Muted> : null}
          {p.description ? <Muted style={{ fontSize: 13, marginTop: 6 }}>{p.description}</Muted> : null}
        </Card>

        {p.modelUrl ? (
          <>
            <H2 style={styles.section}>Live preview</H2>
            <ModelPreview key={p.modelUrl} productId={p.id} height={300} onModelSize={setMeasured} />
            {measured && (
              <View style={[styles.check, { backgroundColor: measured.off ? colors.warnSoft : colors.successSoft }]}>
                <Ionicons name={measured.off ? 'warning-outline' : 'checkmark-circle-outline'} size={16}
                  color={measured.off ? colors.warn : colors.success} />
                <Text style={{ flex: 1, color: measured.off ? colors.warn : colors.success, fontSize: 13 }}>
                  Model measures {measured.model.width} × {measured.model.depth} × {measured.model.height} cm
                  {measured.off ? ': more than 10% off the listed size. Rescale it before shoppers rely on it.' : ', which matches the listing.'}
                </Text>
              </View>
            )}
            <Button small variant="dark" icon="scan-outline" title="Test in AR" style={{ marginTop: space(3) }} onPress={() => openInRoom(p.id)} />
          </>
        ) : null}

        <H2 style={styles.section}>3D model files</H2>
        <Card>
          <Field label="GLB model (required)" value={form.modelUrl} onChangeText={set('modelUrl')} autoCapitalize="none" placeholder="https://…/sofa.glb"
            hint="Powers the 3D viewer and AR on Android and iOS." />
          {uploadButton('modelUrl', 'Upload .glb file')}
          <Field style={{ marginTop: space(4) }} label="USDZ model (optional, iOS)" value={form.iosModelUrl} onChangeText={set('iosModelUrl')}
            autoCapitalize="none" hint="iOS converts the GLB automatically; a USDZ gives the best quality." />
          {uploadButton('iosModelUrl', 'Upload .usdz file')}

          <Text style={[styles.label, { marginTop: space(4) }]}>Place in AR on the</Text>
          <View style={styles.wrap}>
            <Chip label="Floor" icon="square-outline" active={form.placement === 'floor'} onPress={() => set('placement')('floor')} />
            <Chip label="Wall" icon="tablet-landscape-outline" active={form.placement === 'wall'} onPress={() => set('placement')('wall')} />
          </View>
        </Card>

        <View style={{ marginTop: space(5), gap: 10 }}>
          <ErrorBox error={error} />
          <Button title={p.modelUrl ? 'Save & publish' : 'Publish model'} icon="cloud-done-outline" onPress={() => save(form, 'save')}
            loading={busy === 'save'} disabled={!dirty || !form.modelUrl.trim() || !!upload || busy === 'remove'} />
          {p.modelUrl ? (
            <Button title="Remove 3D model" variant="danger" onPress={remove} loading={busy === 'remove'} disabled={!!upload || busy === 'save'} />
          ) : null}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space(5), marginBottom: space(3) },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  photo: { width: 110, height: 110, borderRadius: radius.sm, backgroundColor: '#fff' },
  size: { fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: space(2), borderRadius: radius.sm, marginTop: space(2) },
});
