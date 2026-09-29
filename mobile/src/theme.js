export const colors = {
  bg: '#F6F1EB',
  card: '#FFFAF5',
  ink: '#1F1A17',
  muted: '#6F655D',
  border: '#E7DDD2',
  accent: '#B4552D',
  accentSoft: '#F3E1D6',
  success: '#2F7D4F',
  successSoft: '#DDF0E3',
  danger: '#B3261E',
  dangerSoft: '#F9DEDC',
  warn: '#7A4B00',
  warnSoft: '#FFF1D6',
};

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 };

export const space = (n) => n * 4;

export const shadow = {
  shadowColor: '#3b2a1f',
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

export const STATUS_COLORS = {
  placed: { bg: colors.accentSoft, fg: colors.accent },
  confirmed: { bg: '#E3E8F7', fg: '#2F4A9A' },
  shipped: { bg: colors.warnSoft, fg: colors.warn },
  delivered: { bg: colors.successSoft, fg: colors.success },
  cancelled: { bg: colors.dangerSoft, fg: colors.danger },
};
