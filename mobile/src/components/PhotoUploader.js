import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { assetUrl } from '../lib/config';
import { Button, ErrorBox } from './ui';
import { colors, radius } from '../theme';

let nextKey = 0;

// Uploads photos as soon as they're picked, several at a time, with per-photo progress.
// `onUploaded(url)` attaches a finished upload (and may throw, e.g. if saving it fails).
export function usePhotoUploads(onUploaded, { count, max = 12 }) {
  const [pending, setPending] = useState([]); // { key, uri, asset, progress, error }
  const [error, setError] = useState(null);
  const patch = (key, p) => setPending((list) => list.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const uploadOne = async (item) => {
    patch(item.key, { progress: 0, error: null });
    try {
      const { url } = await api.upload(item.asset, { onProgress: (progress) => patch(item.key, { progress }) });
      await onUploaded(url);
      setPending((list) => list.filter((x) => x.key !== item.key));
    } catch (e) {
      patch(item.key, { error: e.message || 'Upload failed' });
    }
  };

  const pick = async (source) => {
    setError(null);
    const room = max - count - pending.length;
    if (room <= 0) return setError(new Error(`A product can have up to ${max} photos`));
    try {
      let res;
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return setError(new Error('Allow camera access to take product photos'));
        res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
      } else {
        res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: true, selectionLimit: room,
        });
      }
      if (res.canceled || !res.assets?.length) return;
      const items = res.assets.slice(0, room).map((asset) => ({ key: `p${nextKey++}`, uri: asset.uri, asset, progress: 0, error: null }));
      setPending((list) => [...list, ...items]);
      items.forEach(uploadOne);
    } catch (e) {
      setError(e);
    }
  };

  return {
    pending,
    error,
    uploading: pending.some((p) => !p.error),
    pick,
    retry: (item) => uploadOne(item),
    dismiss: (key) => setPending((list) => list.filter((x) => x.key !== key)),
  };
}

export default function PhotoUploader({ images, photos, onRemove, removing }) {
  return (
    <View>
      <View style={styles.grid}>
        {images.map((url, i) => (
          <View key={url} style={styles.tile}>
            <Image source={{ uri: assetUrl(url) }} style={styles.photo} />
            {i === 0 && <Text style={styles.cover}>Cover</Text>}
            <Pressable style={styles.remove} onPress={() => onRemove(url)} disabled={removing === url} accessibilityLabel="Remove photo">
              <Ionicons name={removing === url ? 'hourglass-outline' : 'close'} size={14} color="#fff" />
            </Pressable>
          </View>
        ))}

        {photos.pending.map((p) => (
          <View key={p.key} style={styles.tile}>
            <Image source={{ uri: p.uri }} style={[styles.photo, { opacity: 0.55 }]} />
            {p.error ? (
              <View style={[styles.overlay, { backgroundColor: 'rgba(179,38,30,0.75)' }]}>
                <Pressable onPress={() => photos.retry(p)} accessibilityLabel="Retry upload" style={styles.overlayBtn}>
                  <Ionicons name="refresh" size={18} color="#fff" />
                </Pressable>
                <Pressable onPress={() => photos.dismiss(p.key)} accessibilityLabel="Discard photo" style={styles.overlayBtn}>
                  <Ionicons name="trash-outline" size={16} color="#fff" />
                </Pressable>
              </View>
            ) : (
              <View style={styles.overlay}>
                <Text style={styles.percent}>{Math.round(p.progress * 100)}%</Text>
                <View style={styles.track}>
                  <View style={[styles.bar, { width: `${Math.max(4, p.progress * 100)}%` }]} />
                </View>
              </View>
            )}
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Button small variant="outline" icon="images-outline" title="Add photos" style={{ flex: 1 }} onPress={() => photos.pick('library')} />
        <Button small variant="outline" icon="camera-outline" title="Take photo" style={{ flex: 1 }} onPress={() => photos.pick('camera')} />
      </View>
      {photos.pending.some((p) => p.error) && (
        <ErrorBox error={new Error(photos.pending.find((p) => p.error).error)} />
      )}
      <ErrorBox error={photos.error} />
    </View>
  );
}

const SIZE = 84;
const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  tile: { width: SIZE, height: SIZE, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: '#fff' },
  photo: { width: SIZE, height: SIZE },
  cover: { position: 'absolute', left: 4, bottom: 4, backgroundColor: 'rgba(31,26,23,0.8)', color: '#fff', fontSize: 10, fontWeight: '700', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6, overflow: 'hidden' },
  remove: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  overlayBtn: { padding: 6 },
  percent: { position: 'absolute', top: SIZE / 2 - 18, color: colors.ink, fontWeight: '800', fontSize: 13 },
  track: { position: 'absolute', left: 8, right: 8, bottom: 10, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.8)' },
  bar: { height: 5, borderRadius: 3, backgroundColor: colors.accent },
  actions: { flexDirection: 'row', gap: 8 },
});
