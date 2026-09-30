import { Tabs } from 'expo-router';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { useLiveRefresh } from '../../lib/live';
import { useAuth } from '../../context/AuthContext';
import TabIcon from '../../components/TabIcon';
import { colors } from '../../theme';

export default function SellerTabs() {
  const { shop } = useAuth();
  // New enquiries show up on the Enquiries tab the moment a shopper sends one.
  const inbox = useAsync(() => (shop ? api.enquiries().then((r) => r.enquiries) : Promise.resolve([])), [shop?.id]);
  useLiveRefresh(inbox.reload, (e) => e.type.startsWith('enquiry.'));
  const newCount = (inbox.data || []).filter((e) => e.status === 'new').length;

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
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Enquiries',
          tabBarIcon: (p) => <TabIcon name="chatbubbles" {...p} />,
          tabBarBadge: newCount > 0 ? newCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent },
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Account', tabBarIcon: (p) => <TabIcon name="person" {...p} /> }} />
    </Tabs>
  );
}
