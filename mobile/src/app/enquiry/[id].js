import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/api';
import { assetUrl } from '../../lib/config';
import { callUrl, emailUrl, hasPhone, openLink, whatsappUrl } from '../../lib/contact';
import { CONTACT_LABEL, dateTime, STATUS_LABEL } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, ErrorBox, H2, Loading, Muted, Screen, StatusPill } from '../../components/ui';
import { colors, radius, space } from '../../theme';

const NEXT = {
  new: [['contacted', 'Mark as contacted']],
  contacted: [['closed', 'Close enquiry']],
  closed: [['new', 'Reopen']],
};

export default function EnquiryDetail() {
  const { id } = useLocalSearchParams();
  const { isSeller } = useAuth();
  const { data: e, loading, error, reload } = useAsync(() => api.enquiry(id).then((r) => r.enquiry), [id]);
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState(null);

  if (loading) return <Loading />;
  if (!e) return <Screen><ErrorBox error={error} onRetry={reload} /></Screen>;

  const change = async (status) => {
    setBusy(status);
    setActionError(null);
    try {
      await api.setEnquiryStatus(e.id, status);
      await reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(null);
    }
  };

  // Contacting the shopper also moves a new enquiry to "contacted".
  const reach = (url) => {
    openLink(url);
    if (e.status === 'new') change('contacted');
  };
  const reply = `Hi ${e.name.split(' ')[0]}, thanks for your enquiry about the ${e.productName} at ${e.shopName}. `;

  return (
    <Screen>
      <Pressable style={styles.product} onPress={isSeller ? undefined : () => router.push(`/product/${e.productId}`)}>
        <Image source={{ uri: assetUrl(e.productImage) }} style={styles.thumb} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{e.productName}</Text>
          <Muted style={{ fontSize: 12 }}>{e.shopName}</Muted>
        </View>
        <StatusPill status={e.status} />
      </Pressable>

      <Card style={{ marginTop: space(4) }}>
        <H2 style={{ fontSize: 16 }}>{isSeller ? e.name : 'Your message'}</H2>
        <Muted style={{ fontSize: 12, marginBottom: 8 }}>{dateTime(e.createdAt)}</Muted>
        <Text style={styles.message}>{e.message}</Text>
      </Card>

      {isSeller ? (
        <Card style={{ marginTop: space(4) }}>
          <H2 style={{ fontSize: 16, marginBottom: 6 }}>Contact {e.name.split(' ')[0]}</H2>
          <Muted>Prefers: {CONTACT_LABEL[e.preferredContact]}</Muted>
          <Muted>Phone: {e.phone}</Muted>
          {e.email ? <Muted>Email: {e.email}</Muted> : null}
          <View style={styles.actions}>
            {hasPhone(e.phone) && <Button small title="Call" icon="call-outline" onPress={() => reach(callUrl(e.phone))} />}
            {hasPhone(e.phone) && (
              <Button small title="WhatsApp" icon="logo-whatsapp" variant="outline" onPress={() => reach(whatsappUrl(e.phone, reply))} />
            )}
            {e.email ? (
              <Button small title="Email" icon="mail-outline" variant="outline"
                onPress={() => reach(emailUrl(e.email, `Your enquiry: ${e.productName}`, reply))} />
            ) : null}
          </View>
        </Card>
      ) : (
        <Card style={{ marginTop: space(4) }}>
          <Muted>
            {e.status === 'new'
              ? `${e.shopName} hasn't replied yet. They'll contact you by ${CONTACT_LABEL[e.preferredContact].toLowerCase()} at ${e.preferredContact === 'email' ? e.email : e.phone}.`
              : e.status === 'contacted'
                ? `${e.shopName} has been in touch about this enquiry.`
                : 'This enquiry is closed.'}
          </Muted>
        </Card>
      )}

      <ErrorBox error={actionError} />
      {isSeller && (
        <View style={{ gap: 10, marginTop: space(4) }}>
          {NEXT[e.status].map(([status, label]) => (
            <Button key={status} title={label} variant={status === 'new' ? 'outline' : 'primary'}
              loading={busy === status} disabled={!!busy} onPress={() => change(status)} />
          ))}
        </View>
      )}

      <H2 style={{ fontSize: 16, marginTop: space(6) }}>History</H2>
      {e.history.map((h) => (
        <Muted key={h.at + h.status} style={{ marginTop: 4 }}>{STATUS_LABEL[h.status]} · {dateTime(h.at)}</Muted>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  product: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: radius.md, padding: 10, borderWidth: 1, borderColor: colors.border },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: '#fff' },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  message: { fontSize: 15, color: colors.ink, lineHeight: 22 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space(3) },
});
