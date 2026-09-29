const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export const money = (n) => inr.format(Number(n) || 0);

export const dims = (d) => (d ? `${d.width} W × ${d.depth} D × ${d.height} H cm` : '—');

export const date = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const STATUS_LABEL = {
  placed: 'Placed',
  confirmed: 'Confirmed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

// Status → next statuses a seller can apply (mirrors the backend's TRANSITIONS).
export const SELLER_NEXT = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

export const DELIVERY_FEE = 49; // per shop order — mirrors the backend
