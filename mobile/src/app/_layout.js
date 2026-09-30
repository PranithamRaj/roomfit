import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { Loading } from '../components/ui';
import { colors } from '../theme';

function RootStack() {
  const { ready, user, isSeller } = useAuth();
  if (!ready) return <Loading />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: '700' },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      {/* Shoppers (and guests) get the storefront; sellers get their dashboard. */}
      <Stack.Protected guard={!isSeller}>
        <Stack.Screen name="(shop)" options={{ headerShown: false }} />
        <Stack.Screen name="product/[id]" options={{ title: '' }} />
        <Stack.Screen name="shop/[id]" options={{ title: '' }} />
        {/* Guests can enquire too; no account needed. */}
        <Stack.Screen name="enquire/[id]" options={{ title: 'Enquire', presentation: 'modal' }} />
      </Stack.Protected>

      <Stack.Protected guard={isSeller}>
        <Stack.Screen name="(seller)" options={{ headerShown: false }} />
        <Stack.Screen name="seller/product-form" options={{ title: 'Product' }} />
        <Stack.Screen name="seller/shop-form" options={{ title: 'Shop profile' }} />
      </Stack.Protected>

      <Stack.Protected guard={!!user}>
        <Stack.Screen name="enquiry/[id]" options={{ title: 'Enquiry' }} />
      </Stack.Protected>

      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" options={{ title: 'Sign in', presentation: 'modal' }} />
        <Stack.Screen name="register" options={{ title: 'Create account', presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootStack />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
