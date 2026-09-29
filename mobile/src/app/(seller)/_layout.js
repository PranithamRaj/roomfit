import { Tabs } from 'expo-router';
import TabIcon from '../../components/TabIcon';
import { colors } from '../../theme';

export default function SellerTabs() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', color: colors.ink },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarIcon: (p) => <TabIcon name="stats-chart" {...p} /> }} />
      <Tabs.Screen name="products" options={{ title: 'Products', tabBarIcon: (p) => <TabIcon name="cube" {...p} /> }} />
      <Tabs.Screen name="sales" options={{ title: 'Orders', tabBarIcon: (p) => <TabIcon name="receipt" {...p} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Account', tabBarIcon: (p) => <TabIcon name="person" {...p} /> }} />
    </Tabs>
  );
}
