import { useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { useLiveRefresh } from '../../lib/live';
import ActivityFeed from '../../components/ActivityFeed';
import { Chip, ErrorBox, LiveBadge, Loading, Screen } from '../../components/ui';
import { space } from '../../theme';

const TYPES = [
  { key: '', label: 'Everything' },
  { key: 'enquiry', label: 'Enquiries' },
  { key: 'product', label: 'Products' },
  { key: 'shop', label: 'Shops' },
  { key: 'user', label: 'Accounts' },
];

// The full operations log: every action by shoppers, sellers and admins, newest first.
export default function ActivityLog() {
  const [type, setType] = useState('');
  const { data, loading, error, reload } = useAsync(() => api.adminActivity({ type, limit: 200 }).then((r) => r.activity), [type]);
  useLiveRefresh(reload, (e) => e.type === 'activity.created');

  return (
    <Screen refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}>
      <LiveBadge style={{ marginBottom: space(2) }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space(2) }}>
        {TYPES.map((t) => <Chip key={t.key} label={t.label} active={type === t.key} onPress={() => setType(t.key)} />)}
      </ScrollView>
      <ErrorBox error={error} onRetry={reload} />
      {loading ? <Loading /> : <ActivityFeed items={data} />}
    </Screen>
  );
}
