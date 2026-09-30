import { Linking, Platform } from 'react-native';

const digits = (phone) => String(phone || '').replace(/\D/g, '');

// wa.me needs the full international number. Bare 10-digit numbers are assumed to be
// Indian mobiles (the marketplace's home market), so +91 is added.
export function whatsappNumber(phone) {
  const d = digits(phone);
  return d.length === 10 ? `91${d}` : d;
}

export const hasPhone = (phone) => digits(phone).length >= 7;

export const callUrl = (phone) => `tel:${String(phone).replace(/[^\d+]/g, '')}`;

export const whatsappUrl = (phone, text = '') =>
  `https://wa.me/${whatsappNumber(phone)}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export const emailUrl = (email, subject = '', body = '') =>
  `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

export async function openLink(url) {
  if (Platform.OS === 'web') {
    // tel:/mailto: must replace the page on web; wa.me opens in a new tab.
    if (url.startsWith('http')) window.open(url, '_blank', 'noopener');
    else window.location.href = url;
    return;
  }
  await Linking.openURL(url);
}
