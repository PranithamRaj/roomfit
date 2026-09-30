import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { useLiveRefresh } from '../../lib/live';
import EnquiryList from '../../components/EnquiryList';
import { Button, Empty, Screen } from '../../components/ui';

export default function MyEnquiries() {
  const { user } = useAuth();
  const state = useAsync(
    () => (user ? api.enquiries().then((r) => r.enquiries) : Promise.resolve([])),
    [user?.id],
  );
  // Status changes from the shop (contacted, closed) show up straight away.
  useLiveRefresh(state.reload, (e) => Boolean(user) && e.type.startsWith('enquiry.'));

  if (!user) {
    return (
      <Screen>
        <Empty
          icon="chatbubbles-outline"
          title="Track your enquiries"
          body="You can enquire about any piece without an account. Sign in to keep track of your enquiries here."
          action={<Button title="Sign in" onPress={() => router.push('/login')} />}
        />
      </Screen>
    );
  }
  return (
    <EnquiryList
      state={state}
      perspective="buyer"
      emptyTitle="No enquiries yet"
      emptyBody="Found something you like? Tap Enquire on a product and the shop will get back to you with price and availability."
    />
  );
}
