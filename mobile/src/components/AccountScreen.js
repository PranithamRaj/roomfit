import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { API_URL } from '../lib/config';
import { Button, Card, Empty, H2, Muted, Screen } from './ui';
import { colors, space } from '../theme';

export default function AccountScreen() {
  const { user, shop, logout } = useAuth();
  const { clearLocal } = useCart();

  if (!user) {
    return (
      <Screen>
        <Empty
          icon="person-circle-outline"
          title="You're browsing as a guest"
          body="Sign in to buy, or open a seller account to list your shop's furniture."
          action={
            <View style={{ gap: 10, width: 240 }}>
              <Button title="Sign in" onPress={() => router.push('/login')} />
              <Button title="Create account" variant="outline" onPress={() => router.push('/register')} />
            </View>
          }
        />
        <Muted style={styles.server}>Server: {API_URL}</Muted>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name[0]?.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <H2>{user.name}</H2>
          <Muted>{user.email}</Muted>
          <View style={styles.role}>
            <Ionicons name={user.role === 'seller' ? 'storefront-outline' : 'bag-handle-outline'} size={13} color={colors.accent} />
            <Text style={styles.roleText}>{user.role === 'seller' ? `Seller · ${shop?.name || 'no shop yet'}` : 'Shopper'}</Text>
          </View>
        </View>
      </Card>

      {user.role === 'seller' && (
        <Button title={shop ? 'Edit shop profile' : 'Set up your shop'} icon="storefront-outline" variant="outline"
          style={{ marginTop: space(4) }} onPress={() => router.push('/seller/shop-form')} />
      )}

      <Button
        title="Sign out"
        variant="danger"
        icon="log-out-outline"
        style={{ marginTop: space(4) }}
        onPress={async () => {
          clearLocal();
          await logout();
        }}
      />
      <Muted style={styles.server}>Server: {API_URL}</Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  role: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  roleText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  server: { textAlign: 'center', fontSize: 11, marginTop: space(8) },
});
