export const dims = (d) => (d ? `${d.width} W × ${d.depth} D × ${d.height} H cm` : '—');

export const date = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const dateTime = (iso) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

// "5 min ago", "3 h ago", then a date.
export function timeAgo(iso) {
  const minutes = (Date.now() - new Date(iso).getTime()) / 60000;
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${Math.floor(minutes)} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
  if (minutes < 7 * 24 * 60) return `${Math.floor(minutes / (24 * 60))} d ago`;
  return date(iso);
}

// A length of time in ms, e.g. an average response time.
export function duration(ms) {
  if (ms === null || ms === undefined) return '—';
  if (ms < 60 * 60000) return `${Math.max(1, Math.round(ms / 60000))} min`;
  if (ms < 24 * 60 * 60000) return `${(ms / (60 * 60000)).toFixed(1)} h`;
  return `${(ms / (24 * 60 * 60000)).toFixed(1)} days`;
}

export const ROLE_LABEL = { buyer: 'Shopper', seller: 'Seller', admin: 'Admin', guest: 'Guest shopper' };

// Enquiry follow-up statuses (mirrors the backend).
export const STATUS_LABEL = {
  new: 'New',
  contacted: 'Contacted',
  closed: 'Closed',
};

export const CONTACT_LABEL = {
  call: 'Phone call',
  whatsapp: 'WhatsApp',
  email: 'Email',
};
