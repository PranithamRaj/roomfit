import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { api } from '../../lib/api';
import { STATUS_LABEL } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { useLiveRefresh } from '../../lib/live';
import EnquiryList from '../../components/EnquiryList';
import { Chip, LiveBadge, Muted, SearchBar } from '../../components/ui';

const FILTERS = ['open', 'new', 'contacted', 'closed', 'all'];
const FILTER_LABEL = { open: 'Open', all: 'All', ...STATUS_LABEL };

// Every enquiry across every shop, as it arrives.
export default function AllEnquiries() {
  const [filter, setFilter] = useState('open');
  const [q, setQ] = useState('');
  const state = useAsync(
    () => api.adminEnquiries({ status: filter === 'all' ? undefined : filter }).then((r) => r.enquiries),
    [filter],
  );
  useLiveRefresh(state.reload, (e) => e.type.startsWith('enquiry.'));

  const term = q.trim().toLowerCase();
  const shown = (state.data || []).filter((e) =>
    !term || `${e.name} ${e.phone} ${e.email} ${e.productName} ${e.shopName} ${e.message}`.toLowerCase().includes(term));

  return (
    <EnquiryList
      state={{ ...state, data: shown }}
      perspective="admin"
      emptyTitle="No enquiries here"
      emptyBody="Enquiries shoppers send to any shop appear here the moment they're sent."
      header={
        <View style={{ marginBottom: 12 }}>
          <SearchBar value={q} onChangeText={setQ} placeholder="Search shopper, phone, product, shop…" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            {FILTERS.map((f) => (
              <Chip key={f} label={FILTER_LABEL[f]} active={filter === f} onPress={() => setFilter(f)} />
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Muted style={{ fontSize: 13 }}>{shown.length} {shown.length === 1 ? 'enquiry' : 'enquiries'}</Muted>
            <LiveBadge />
          </View>
        </View>
      }
    />
  );
}
