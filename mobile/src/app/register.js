import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { Button, ErrorBox, Field, H1, Muted, Screen } from '../components/ui';
import { colors, radius, space } from '../theme';

const ROLES = [
  { key: 'buyer', icon: 'bag-handle-outline', title: "I'm shopping", body: 'Browse shops and try furniture in my room' },
  { key: 'seller', icon: 'storefront-outline', title: 'I sell furniture', body: 'List my shop’s pieces with 3D/AR models' },
];

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'buyer' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await register(form);
      if (form.role === 'seller') router.replace('/seller/shop-form');
      else if (router.canGoBack()) router.back();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <H1>Create your account</H1>
      <Muted style={{ marginBottom: space(4) }}>Choose how you&apos;ll use RoomFit.</Muted>
      <View style={{ gap: 10, marginBottom: space(4) }}>
        {ROLES.map((r) => {
          const active = form.role === r.key;
          return (
            <Pressable key={r.key} onPress={() => set('role')(r.key)} style={[styles.role, active && styles.roleActive]}
              role="radio" aria-checked={active}>
              <Ionicons name={r.icon} size={24} color={active ? colors.accent : colors.muted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.roleTitle}>{r.title}</Text>
                <Muted style={{ fontSize: 13 }}>{r.body}</Muted>
              </View>
              <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? colors.accent : colors.border} />
            </Pressable>
          );
        })}
      </View>
      <ErrorBox error={error} />
      <Field label="Full name" value={form.name} onChangeText={set('name')} autoComplete="name" />
      <Field label="Email" value={form.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Password" value={form.password} onChangeText={set('password')} secureTextEntry hint="At least 6 characters" autoComplete="new-password" />
      <Button title="Create account" onPress={submit} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  role: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  roleActive: { borderColor: colors.accent, backgroundColor: '#fff' },
  roleTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
});
