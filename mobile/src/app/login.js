import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { Button, ErrorBox, Field, H1, Muted, Screen } from '../components/ui';
import { colors, space } from '../theme';

const DEMO = [
  { label: 'Demo shopper', email: 'buyer@roomfit.test' },
  { label: 'Demo seller', email: 'seller@oakandloom.test' },
  { label: 'Demo admin', email: 'admin@roomfit.test' },
];

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e = email, p = password) => {
    setBusy(true);
    setError(null);
    try {
      await login(e, p);
      if (router.canGoBack()) router.back();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <H1>Welcome back</H1>
      <Muted style={{ marginBottom: space(5) }}>Sign in to shop, or to manage your store.</Muted>
      <ErrorBox error={error} />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" onSubmitEditing={() => submit()} />
      <Button title="Sign in" onPress={() => submit()} loading={busy} />

      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: space(4) }}>
        <Muted>New here? </Muted>
        <Link href="/register" replace asChild>
          <Pressable><Text style={{ color: colors.accent, fontWeight: '700' }}>Create an account</Text></Pressable>
        </Link>
      </View>

      <View style={{ marginTop: space(8), gap: 8 }}>
        <Muted style={{ textAlign: 'center', fontSize: 12 }}>Try the demo (password: password123)</Muted>
        {DEMO.map((d) => (
          <Button key={d.email} small variant="outline" title={`${d.label} · ${d.email}`} onPress={() => submit(d.email, 'password123')} disabled={busy} />
        ))}
      </View>
    </Screen>
  );
}
