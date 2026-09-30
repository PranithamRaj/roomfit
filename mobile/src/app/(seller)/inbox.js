import { useState } from 'react';
import { ScrollView } from 'react-native';
import { api } from '../../lib/api';
import { STATUS_LABEL } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { useLiveRefresh } from '../../lib/live';
import EnquiryList from '../../components/EnquiryList';
import DemoModeNotice from '../../components/DemoModeNotice';
import { Chip, LiveBadge } from '../../components/ui';

const FILTERS = ['open', 'new', 'contacted', 'closed', 'all'];
const FILTER_LABEL = { open: 'Open', all: 'All', ...STATUS_LABEL };

export default function SellerInbox() {
  const [filter, setFilter] = useState('open');
  const state = useAsync(() => api.enquiries().then((r) => r.enquiries));
  // A shopper's enquiry lands here the moment they send it.
  useLiveRefresh(state.reload, (e) => e.type.startsWith('enquiry.'));
  const filtered = (state.data || []).filter((e) =>
    filter === 'all' ? true : filter === 'open' ? e.status !== 'closed' : e.status === filter);

  return (
    <EnquiryList
      state={{ ...state, data: filtered }}
      perspective="seller"
      emptyTitle="No enquiries here"
      emptyBody="When shoppers enquire about your pieces, they'll appear here with their contact details."
      header={
        <>
          <DemoModeNotice />
          <LiveBadge style={{ marginBottom: 8 }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {FILTERS.map((f) => (
              <Chip key={f} label={FILTER_LABEL[f]} active={filter === f} onPress={() => setFilter(f)} />
            ))}
          </ScrollView>
        </>
      }
    />
  );
}
