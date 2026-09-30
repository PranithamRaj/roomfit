import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, space, STATUS_COLORS } from '../theme';
import { STATUS_LABEL } from '../lib/format';

export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, style, small }) {
  const v = VARIANTS[variant];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      role="button"
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && { opacity: 0.85 },
        off && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Ionicons name={icon} size={small ? 16 : 18} color={v.fg} style={{ marginRight: 6 }} />}
          <Text style={[styles.btnText, small && { fontSize: 14 }, { color: v.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const VARIANTS = {
  primary: { bg: colors.accent, fg: '#fff', border: colors.accent },
  dark: { bg: colors.ink, fg: '#fff', border: colors.ink },
  outline: { bg: 'transparent', fg: colors.ink, border: colors.border },
  danger: { bg: 'transparent', fg: colors.danger, border: colors.dangerSoft },
};

export function Field({ label, hint, error, style, ...props }) {
  return (
    <View style={[{ marginBottom: space(3) }, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor="#a89c90"
        style={[styles.input, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, error && { borderColor: colors.danger }]}
        {...props}
      />
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
      {error && <Text style={[styles.hint, { color: colors.danger }]}>{error}</Text>}
    </View>
  );
}

export function Chip({ label, active, onPress, icon }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: colors.ink, borderColor: colors.ink }]}
      role="button"
      aria-selected={!!active}
    >
      {icon && <Ionicons name={icon} size={14} color={active ? '#fff' : colors.ink} style={{ marginRight: 4 }} />}
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export const Card = ({ children, style }) => <View style={[styles.card, style]}>{children}</View>;

export function Screen({ children, scroll = true, style, refreshControl }) {
  if (!scroll) return <View style={[styles.screen, style]}>{children}</View>;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[{ padding: space(4), paddingBottom: space(12) }, style]}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  );
}

export const H1 = ({ children, style }) => <Text style={[styles.h1, style]}>{children}</Text>;
export const H2 = ({ children, style }) => <Text style={[styles.h2, style]}>{children}</Text>;
export const Muted = ({ children, style }) => <Text style={[styles.muted, style]}>{children}</Text>;

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <View style={styles.error}>
      <Ionicons name="alert-circle" size={18} color={colors.danger} />
      <Text style={styles.errorText}>{error.message || String(error)}</Text>
      {onRetry && <Button small variant="outline" title="Retry" onPress={onRetry} />}
    </View>
  );
}

export function Empty({ icon = 'cube-outline', title, body, action }) {
  return (
    <View style={[styles.center, { paddingVertical: space(12) }]}>
      <Ionicons name={icon} size={44} color={colors.muted} />
      <Text style={[styles.h2, { marginTop: space(3), textAlign: 'center' }]}>{title}</Text>
      {body && <Muted style={{ textAlign: 'center', marginTop: space(1), maxWidth: 280 }}>{body}</Muted>}
      {action && <View style={{ marginTop: space(4) }}>{action}</View>}
    </View>
  );
}

export function Badge({ label, icon, tone = 'accent' }) {
  const palette = {
    accent: [colors.accentSoft, colors.accent],
    success: [colors.successSoft, colors.success],
    dark: ['rgba(31,26,23,0.85)', '#fff'],
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette[0] }]}>
      {icon && <Ionicons name={icon} size={12} color={palette[1]} style={{ marginRight: 3 }} />}
      <Text style={[styles.badgeText, { color: palette[1] }]}>{label}</Text>
    </View>
  );
}

export function StatusPill({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.new;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{STATUS_LABEL[status] || status}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(6), backgroundColor: colors.bg },
  btn: {
    borderRadius: radius.pill, borderWidth: 1, paddingVertical: 13, paddingHorizontal: 20,
    alignItems: 'center', justifyContent: 'center', minHeight: 48,
  },
  btnSmall: { paddingVertical: 7, paddingHorizontal: 14, minHeight: 34 },
  btnText: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 6 },
  hint: { fontSize: 12, color: colors.muted, marginTop: 4 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: colors.ink,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
    borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, marginBottom: 8,
  },
  chipText: { fontSize: 14, color: colors.ink, fontWeight: '500' },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: space(4), borderWidth: 1, borderColor: colors.border, ...shadow },
  h1: { fontSize: 26, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  h2: { fontSize: 18, fontWeight: '700', color: colors.ink },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  error: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.dangerSoft,
    padding: space(3), borderRadius: radius.sm, marginBottom: space(3),
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 14 },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '600' },
});
