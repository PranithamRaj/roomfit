import { Platform } from 'react-native';
import { API_URL } from './config';

let authToken = null;
const tokenListeners = new Set();
export const getAuthToken = () => authToken;
export const setAuthToken = (token) => {
  if (token === authToken) return;
  authToken = token;
  for (const listener of tokenListeners) listener(token);
};
// The live-update stream reconnects as the signed-in user whenever the token changes.
export function onAuthTokenChange(listener) {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
}

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
// Uses XMLHttpRequest because fetch can't report upload progress; onProgress gets 0..1.
function upload(asset, { onProgress } = {}) {
  const form = new FormData();
  const name = asset.fileName || asset.name || asset.uri.split('/').pop();
  if (Platform.OS === 'web' && asset.file) form.append('file', asset.file, name);
  else form.append('file', { uri: asset.uri, name, type: asset.mimeType || 'application/octet-stream' });

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/api/uploads`);
    if (authToken) xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
    }
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // not JSON (e.g. a proxy error page)
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new ApiError(data.error || `Upload failed (${xhr.status})`, xhr.status));
    };
    xhr.onerror = () => reject(new ApiError(`Can't reach the RoomFit server at ${API_URL}. Is the backend running?`, 0));
    xhr.send(form);
  });
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
  // photos go live on the listing one at a time, as each upload finishes
  addProductImage: (id, url) => request('POST', `/api/products/${id}/images`, { body: { url } }),
  removeProductImage: (id, url) => request('DELETE', `/api/products/${id}/images`, { query: { url } }),
  upload,
  // admin: 3D/AR models
  adminProducts: (query) => request('GET', '/api/admin/products', { query }),
  setProductAr: (id, data) => request('PUT', `/api/admin/products/${id}/ar`, { body: data }),
  // admin: operations oversight and moderation
  adminOverview: () => request('GET', '/api/admin/overview'),
  adminActivity: (query) => request('GET', '/api/admin/activity', { query }),
  adminEnquiries: (query) => request('GET', '/api/admin/enquiries', { query }),
  deleteEnquiry: (id) => request('DELETE', `/api/admin/enquiries/${id}`),
  adminShops: () => request('GET', '/api/admin/shops'),
  adminShop: (id) => request('GET', `/api/admin/shops/${id}`),
  setShopSuspended: (id, suspended) => request('PATCH', `/api/admin/shops/${id}`, { body: { suspended } }),
  adminUsers: (query) => request('GET', '/api/admin/users', { query }),
  adminUser: (id) => request('GET', `/api/admin/users/${id}`),
  setUserSuspended: (id, suspended) => request('PATCH', `/api/admin/users/${id}`, { body: { suspended } }),
};
