import { useState } from 'react';
import { ScrollView } from 'react-native';
import { api } from '../../lib/api';
import { STATUS_LABEL } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import EnquiryList from '../../components/EnquiryList';
import { Chip } from '../../components/ui';

const FILTERS = ['open', 'new', 'contacted', 'closed', 'all'];
const FILTER_LABEL = { open: 'Open', all: 'All', ...STATUS_LABEL };

export default function SellerInbox() {
  const [filter, setFilter] = useState('open');
  const state = useAsync(() => api.enquiries().then((r) => r.enquiries), [], { refetchOnFocus: true });
  const filtered = (state.data || []).filter((e) =>
    filter === 'all' ? true : filter === 'open' ? e.status !== 'closed' : e.status === filter);

  return (
    <EnquiryList
      state={{ ...state, data: filtered }}
      perspective="seller"
      emptyTitle="No enquiries here"
      emptyBody="When shoppers enquire about your pieces, they'll appear here with their contact details."
      header={
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {FILTERS.map((f) => (
            <Chip key={f} label={FILTER_LABEL[f]} active={filter === f} onPress={() => setFilter(f)} />
          ))}
        </ScrollView>
      }
    />
  );
}
