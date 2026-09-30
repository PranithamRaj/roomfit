export const dims = (d) => (d ? `${d.width} W × ${d.depth} D × ${d.height} H cm` : '—');

export const date = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const dateTime = (iso) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

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
