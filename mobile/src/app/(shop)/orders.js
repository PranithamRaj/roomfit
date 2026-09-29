import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import OrderList from '../../components/OrderList';
import { Button, Empty, Screen } from '../../components/ui';

export default function Orders() {
  const { user } = useAuth();
  const state = useAsync(() => (user ? api.orders().then((r) => r.orders) : Promise.resolve([])), [user?.id], { refetchOnFocus: true });

  if (!user) {
    return (
      <Screen>
        <Empty icon="receipt-outline" title="Track your orders" body="Sign in to see orders and delivery status."
          action={<Button title="Sign in" onPress={() => router.push('/login')} />} />
      </Screen>
    );
  }
  return <OrderList state={state} perspective="buyer" emptyTitle="No orders yet" emptyBody="When you buy something it'll show up here." />;
}
