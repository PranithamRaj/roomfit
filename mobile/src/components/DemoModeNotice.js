import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { colors, radius, space } from '../theme';

// Without a database the server keeps data in memory, separately on every serverless instance,
// so new enquiries, products and photos can vanish between requests. Warn the people who add data.
export default function DemoModeNotice({ style }) {
  const { data } = useAsync(() => api.health().catch(() => null));
  if (!data?.demoMode) return null;
  return (
    <View style={[styles.box, style]} role="alert">
      <Ionicons name="warning-outline" size={18} color={colors.warn} />
      <Text style={styles.text}>
        <Text style={{ fontWeight: '700' }}>Demo mode: no database connected.</Text> New enquiries, products and photos are
        not saved and can disappear after a moment. Connect MongoDB (set MONGODB_URI) to keep them.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: 8, backgroundColor: colors.warnSoft, borderRadius: radius.sm, padding: space(3), marginBottom: space(3) },
  text: { flex: 1, color: colors.warn, fontSize: 13, lineHeight: 18 },
});
