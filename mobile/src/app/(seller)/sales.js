import { useState } from 'react';
import { ScrollView } from 'react-native';
import { api } from '../../lib/api';
import { STATUS_LABEL } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import OrderList from '../../components/OrderList';
import { Chip } from '../../components/ui';

const FILTERS = ['open', 'placed', 'confirmed', 'shipped', 'delivered', 'cancelled'];

export default function SellerOrders() {
  const [filter, setFilter] = useState('open');
  const state = useAsync(() => api.orders().then((r) => r.orders), [], { refetchOnFocus: true });
  const filtered = (state.data || []).filter((o) =>
    filter === 'open' ? !['delivered', 'cancelled'].includes(o.status) : o.status === filter);

  return (
    <OrderList
      state={{ ...state, data: filtered }}
      perspective="seller"
      emptyTitle="No orders here"
      emptyBody="New orders from shoppers will appear here for you to confirm and ship."
      header={
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {FILTERS.map((f) => (
            <Chip key={f} label={f === 'open' ? 'Open' : STATUS_LABEL[f]} active={filter === f} onPress={() => setFilter(f)} />
          ))}
        </ScrollView>
      }
    />
  );
}
