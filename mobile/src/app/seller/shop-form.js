import { useState } from 'react';
import { Image, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../lib/api';
import { goBack } from '../../lib/nav';
import { assetUrl } from '../../lib/config';
import { useAuth } from '../../context/AuthContext';
import { Button, ErrorBox, Field, H1, Muted, Screen } from '../../components/ui';
import { colors, radius, space } from '../../theme';

const FIELDS = ['name', 'description', 'city', 'address', 'phone', 'logo', 'coverImage'];

export default function ShopForm() {
  const { shop, refreshShop } = useAuth();
  const [form, setForm] = useState(() => Object.fromEntries(FIELDS.map((k) => [k, shop?.[k] || ''])));
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const pick = async (field) => {
    setError(null);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (res.canceled) return;
      setBusy(field);
      const { url } = await api.upload(res.assets[0]);
      set(field)(url);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy('save');
    setError(null);
    try {
      if (shop) await api.updateShop(shop.id, form);
      else await api.createShop(form);
      await refreshShop();
      goBack('/dashboard');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <H1>{shop ? 'Your shop' : 'Set up your shop'}</H1>
      <Muted style={{ marginBottom: space(4) }}>This is what shoppers see on your storefront.</Muted>
      <Field label="Shop name" value={form.name} onChangeText={set('name')} />
      <Field label="About the shop" value={form.description} onChangeText={set('description')} multiline />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Field style={{ flex: 1 }} label="City" value={form.city} onChangeText={set('city')} />
        <Field style={{ flex: 1 }} label="Phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      </View>
      <Field label="Address" value={form.address} onChangeText={set('address')} />

      {[['logo', 'Logo'], ['coverImage', 'Cover photo']].map(([k, label]) => (
        <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: space(3) }}>
          {form[k] ? (
            <Image source={{ uri: assetUrl(form[k]) }} style={{ width: 56, height: 56, borderRadius: radius.sm, backgroundColor: '#fff' }} />
          ) : (
            <View style={{ width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.accentSoft }} />
          )}
          <Button small variant="outline" icon="image-outline" title={form[k] ? `Change ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}
            loading={busy === k} onPress={() => pick(k)} />
        </View>
      ))}

      <ErrorBox error={error} />
      <Button title={shop ? 'Save shop' : 'Create shop'} onPress={save} loading={busy === 'save'} style={{ marginTop: space(2) }} />
    </Screen>
  );
}
