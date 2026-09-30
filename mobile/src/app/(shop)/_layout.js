import { Tabs } from 'expo-router';
import TabIcon from '../../components/TabIcon';
import { colors } from '../../theme';

export default function ShopTabs() {
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
      <Tabs.Screen name="index" options={{ title: 'Home', headerShown: false, tabBarIcon: (p) => <TabIcon name="home" {...p} /> }} />
      <Tabs.Screen name="browse" options={{ title: 'Browse', tabBarIcon: (p) => <TabIcon name="search" {...p} /> }} />
      <Tabs.Screen name="enquiries" options={{ title: 'Enquiries', tabBarIcon: (p) => <TabIcon name="chatbubbles" {...p} /> }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: (p) => <TabIcon name="person" {...p} /> }} />
    </Tabs>
  );
}
