import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ROLE_LABEL, timeAgo } from '../lib/format';
import { Muted } from './ui';
import { colors, radius } from '../theme';

const ICONS = {
  'user.registered': 'person-add-outline',
  'user.suspended': 'ban-outline',
  'user.restored': 'checkmark-circle-outline',
  'enquiry.created': 'chatbubble-ellipses-outline',
  'enquiry.status': 'swap-horizontal-outline',
  'enquiry.deleted': 'trash-outline',
  'product.created': 'add-circle-outline',
  'product.updated': 'create-outline',
  'product.photo': 'image-outline',
  'product.deleted': 'remove-circle-outline',
  'product.ar': 'scan-outline',
  'shop.created': 'storefront-outline',
  'shop.updated': 'storefront-outline',
  'shop.suspended': 'ban-outline',
  'shop.restored': 'checkmark-circle-outline',
};
const ALERT = new Set(['user.suspended', 'shop.suspended', 'enquiry.deleted']);

// Where tapping an entry goes: the enquiry, the account, the product's 3D model, or the shop.
function target(a) {
  if (a.enquiryId && a.type !== 'enquiry.deleted') return `/enquiry/${a.enquiryId}`;
  if (a.userId) return `/admin/user/${a.userId}`;
  if (a.productId && a.type !== 'product.deleted') return { pathname: '/admin/ar-model', params: { id: a.productId } };
  if (a.shopId) return `/admin/shop/${a.shopId}`;
  return null;
}

// Admin operations log: who did what, newest first.
export default function ActivityFeed({ items, empty = 'Nothing yet. Activity from sellers and shoppers appears here as it happens.' }) {
  if (!items?.length) return <Muted style={{ paddingVertical: 12 }}>{empty}</Muted>;
  return (
    <View style={styles.list}>
      {items.map((a, i) => {
        const href = target(a);
        return (
          <Pressable key={a.id} disabled={!href} onPress={() => router.push(href)}
            style={[styles.row, i > 0 && styles.divider]} role={href ? 'button' : undefined}>
            <View style={[styles.icon, ALERT.has(a.type) && { backgroundColor: colors.dangerSoft }]}>
              <Ionicons name={ICONS[a.type] || 'ellipse-outline'} size={16} color={ALERT.has(a.type) ? colors.danger : colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summary}>{a.summary}</Text>
              <Muted style={{ fontSize: 12 }}>{ROLE_LABEL[a.actorRole] || a.actorRole} · {timeAgo(a.createdAt)}</Muted>
            </View>
            {href && <Ionicons name="chevron-forward" size={16} color={colors.muted} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  icon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  summary: { fontSize: 14, color: colors.ink, lineHeight: 19 },
});
