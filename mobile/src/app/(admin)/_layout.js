import { Tabs } from 'expo-router';
import TabIcon from '../../components/TabIcon';
import { colors } from '../../theme';

// The admin portal: oversight of every seller's and shopper's activity, moderation, and the AR studio.
// Route names are prefixed or distinct so they don't clash with the shopper and seller tabs (same URL space).
export default function AdminTabs() {
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
      <Tabs.Screen name="overview" options={{ title: 'Overview', tabBarIcon: (p) => <TabIcon name="grid" {...p} /> }} />
      <Tabs.Screen name="all-enquiries" options={{ title: 'Enquiries', tabBarIcon: (p) => <TabIcon name="chatbubbles" {...p} /> }} />
      <Tabs.Screen name="shops" options={{ title: 'Shops', tabBarIcon: (p) => <TabIcon name="storefront" {...p} /> }} />
      <Tabs.Screen name="users" options={{ title: 'Users', tabBarIcon: (p) => <TabIcon name="people" {...p} /> }} />
      <Tabs.Screen name="studio" options={{ title: 'AR studio', tabBarIcon: (p) => <TabIcon name="cube" {...p} /> }} />
      {/* Opened from the Overview header rather than a tab. */}
      <Tabs.Screen name="admin-account" options={{ title: 'Account', href: null }} />
    </Tabs>
  );
}
