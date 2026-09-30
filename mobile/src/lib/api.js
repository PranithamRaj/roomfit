import { Platform } from 'react-native';
import { API_URL } from './config';

let authToken = null;
export const setAuthToken = (token) => {
  authToken = token;
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, { body, query, form } = {}) {
  const qs = query
    ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== '' && v !== null)).toString()
    : '';
  const headers = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${API_URL}${path}${qs}`, {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError(`Can't reach the RoomFit server at ${API_URL}. Is the backend running?`, 0);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  return data;
}

// Uploads a picked image/model. `asset` is an expo-image-picker or expo-document-picker asset.
async function upload(asset) {
  const form = new FormData();
  const name = asset.fileName || asset.name || asset.uri.split('/').pop();
  if (Platform.OS === 'web' && asset.file) form.append('file', asset.file, name);
  else form.append('file', { uri: asset.uri, name, type: asset.mimeType || 'application/octet-stream' });
  return request('POST', '/api/uploads', { form });
}

export const api = {
  // auth
  login: (email, password) => request('POST', '/api/auth/login', { body: { email, password } }),
  register: (payload) => request('POST', '/api/auth/register', { body: payload }),
  me: () => request('GET', '/api/auth/me'),
  health: () => request('GET', '/api/health'),
  // catalogue
  categories: () => request('GET', '/api/products/categories'),
  products: (query) => request('GET', '/api/products', { query }),
  product: (id) => request('GET', `/api/products/${id}`),
  shops: (query) => request('GET', '/api/shops', { query }),
  shop: (id) => request('GET', `/api/shops/${id}`),
  // enquiries (listings have no prices; shoppers enquire instead)
  sendEnquiry: (payload) => request('POST', '/api/enquiries', { body: payload }),
  enquiries: () => request('GET', '/api/enquiries'),
  enquiry: (id) => request('GET', `/api/enquiries/${id}`),
  setEnquiryStatus: (id, status) => request('PATCH', `/api/enquiries/${id}/status`, { body: { status } }),
  // seller
  myShop: () => request('GET', '/api/shops/mine'),
  createShop: (data) => request('POST', '/api/shops', { body: data }),
  updateShop: (id, data) => request('PUT', `/api/shops/${id}`, { body: data }),
  createProduct: (data) => request('POST', '/api/products', { body: data }),
  updateProduct: (id, data) => request('PUT', `/api/products/${id}`, { body: data }),
  deleteProduct: (id) => request('DELETE', `/api/products/${id}`),
  upload,
};
