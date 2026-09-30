import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/api';
import { assetUrl } from '../../lib/config';
import { hasPhone, openLink, whatsappUrl } from '../../lib/contact';
import { dims } from '../../lib/format';
import { goBack } from '../../lib/nav';
import { useAsync } from '../../lib/useAsync';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, Chip, Empty, ErrorBox, Field, H2, Loading, Muted, Screen } from '../../components/ui';
import { colors, radius, space } from '../../theme';

const METHODS = [
  { key: 'call', label: 'Call me', icon: 'call-outline' },
  { key: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp' },
  { key: 'email', label: 'Email', icon: 'mail-outline' },
];

export default function Enquire() {
  const { id } = useLocalSearchParams();
  const product = useAsync(() => api.product(id).then((r) => r.product), [id]);
  if (product.loading) return <Loading />;
  if (!product.data) return <Screen><ErrorBox error={product.error} onRetry={product.reload} /></Screen>;
  return <EnquiryForm key={id} product={product.data} />;
}

function EnquiryForm({ product }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: '',
    email: user?.email || '',
    preferredContact: 'call',
    message: `Hi, I'm interested in the ${product.name}. Could you share the price and availability?`,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const shopPhone = product.shop?.phone;

  if (sent) {
    return (
      <Screen>
        <Empty
          icon="checkmark-circle-outline"
          title="Enquiry sent!"
          body={`${product.shop?.name || 'The shop'} will contact you by ${
            sent.preferredContact === 'whatsapp' ? 'WhatsApp' : sent.preferredContact === 'email' ? 'email' : 'phone'
          } with the price and availability.`}
          action={
            <View style={{ gap: 10, width: 260 }}>
              {hasPhone(shopPhone) && (
                <Button title="Message the shop on WhatsApp" icon="logo-whatsapp" variant="outline"
                  onPress={() => openLink(whatsappUrl(shopPhone, sent.message))} />
              )}
              {user && <Button title="View my enquiries" onPress={() => router.replace('/enquiries')} />}
              <Button title="Back to product" variant="outline" onPress={() => goBack(`/product/${product.id}`)} />
            </View>
          }
        />
      </Screen>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const { enquiry } = await api.sendEnquiry({ productId: product.id, ...form });
      setSent(enquiry);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card style={styles.product}>
        <Image source={{ uri: assetUrl(product.images?.[0]) }} style={styles.thumb} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
          <Muted style={{ fontSize: 12 }}>{product.shop?.name}{product.shop?.city ? ` · ${product.shop.city}` : ''}</Muted>
          <Muted style={{ fontSize: 12 }}>{dims(product.dimensions)}</Muted>
        </View>
      </Card>

      <H2 style={{ marginTop: space(5), marginBottom: space(1) }}>Ask about price & availability</H2>
      <Muted style={{ marginBottom: space(4) }}>The shop will get back to you directly. No account needed.</Muted>

      <Field label="Your name" value={form.name} onChangeText={set('name')} autoComplete="name" />
      <Field label="Phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel"
        placeholder="e.g. 98765 43210" />
      <Field label={form.preferredContact === 'email' ? 'Email' : 'Email (optional)'} value={form.email}
        onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />

      <Text style={styles.label}>How should the shop contact you?</Text>
      <View style={styles.chips}>
        {METHODS.map((m) => (
          <Chip key={m.key} label={m.label} icon={m.icon} active={form.preferredContact === m.key}
            onPress={() => set('preferredContact')(m.key)} />
        ))}
      </View>

      <Field label="Message" value={form.message} onChangeText={set('message')} multiline
        hint="Mention colour, quantity, delivery area or your room size if it helps." />

      <ErrorBox error={error} />
      <Button title="Send enquiry" icon="send-outline" onPress={submit} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  product: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: '#fff' },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space(2) },
});
