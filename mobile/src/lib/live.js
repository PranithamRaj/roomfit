import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { fetch } from 'expo/fetch';
import { API_URL } from './config';
import { getAuthToken, onAuthTokenChange } from './api';

// Live updates. The server streams change events over Server-Sent Events (GET /api/events);
// screens subscribe with useLiveRefresh and refetch when a relevant event arrives.
// Events look like { type: 'enquiry.created', enquiryId, shopId } or { type: 'product.updated', productId, shopId }.
// Where the server can't stream (Vercel answers 501) or while reconnecting, screens poll instead.
const POLL_MS = 5000;
const RETRY_MS = [1000, 2000, 5000, 10000, 30000];
const NO_STREAM_RETRY_MS = 5 * 60 * 1000;
const LINGER_MS = 15000; // keep the stream open briefly between screens

const listeners = new Set();
const statusListeners = new Set();
let live = false;
let controller = null;
let stopTimer = null;

function setLive(next) {
  if (next === live) return;
  live = next;
  for (const l of statusListeners) l();
}
const emit = (event) => {
  for (const l of listeners) l(event);
};

const sleep = (ms, signal) =>
  new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    });
  });

// Reads `data:` frames until the stream ends. `onReady` runs when the server confirms the stream.
async function readEvents(body, onReady) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buf += decoder.decode(value, { stream: true });
    let end;
    while ((end = buf.indexOf('\n\n')) >= 0) {
      const data = buf.slice(0, end).split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('');
      buf = buf.slice(end + 2);
      if (!data) continue; // heartbeat comment
      let event;
      try {
        event = JSON.parse(data);
      } catch {
        continue;
      }
      if (event.type === 'ready') onReady();
      else emit(event);
    }
  }
}

async function run(signal) {
  let attempt = 0;
  let connectedBefore = false;
  while (!signal.aborted) {
    let retryIn = RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)];
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_URL}/api/events`, {
        headers: { Accept: 'text/event-stream', ...(token && { Authorization: `Bearer ${token}` }) },
        signal,
      });
      if (res.status === 501) retryIn = NO_STREAM_RETRY_MS;
      else if (res.ok && res.body) {
        await readEvents(res.body, () => {
          attempt = 0;
          setLive(true);
          // Anything may have changed while disconnected, so let screens refetch.
          if (connectedBefore) emit({ type: 'resync' });
          connectedBefore = true;
        });
        retryIn = RETRY_MS[0];
      }
    } catch {
      // network error or aborted: retry below
    }
    if (signal.aborted) return; // a newer connection owns the status now
    attempt += 1;
    setLive(false);
    await sleep(retryIn, signal);
  }
}

function start() {
  clearTimeout(stopTimer);
  stopTimer = null;
  if (controller) return;
  controller = new AbortController();
  run(controller.signal);
}

function stop() {
  controller?.abort();
  controller = null;
  setLive(false);
}

// Reconnect as the new user after sign-in / sign-out, and after the app returns to the foreground.
function restart() {
  if (!controller) return;
  stop();
  start();
}
onAuthTokenChange(restart);
AppState.addEventListener('change', (state) => {
  if (state === 'active' && listeners.size) {
    stop();
    start();
    emit({ type: 'resync' });
  }
});

export function subscribeLive(listener) {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
    if (!listeners.size && !stopTimer) {
      stopTimer = setTimeout(() => {
        stopTimer = null;
        if (!listeners.size) stop();
      }, LINGER_MS);
    }
  };
}

const subscribeStatus = (cb) => {
  statusListeners.add(cb);
  return () => statusListeners.delete(cb);
};
const getLive = () => live;

// true while the live stream is connected; false while polling.
export const useLiveStatus = () => useSyncExternalStore(subscribeStatus, getLive, getLive);

// While the screen is focused, calls `reload` when an event matching `match(event)` arrives,
// or every few seconds when the live stream isn't available. Also reloads when the screen
// regains focus, to catch anything that changed while another screen was on top.
export function useLiveRefresh(reload, match) {
  const latest = useRef({ reload, match });
  useEffect(() => {
    latest.current = { reload, match };
  });
  const focusedBefore = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) latest.current.reload();
      focusedBefore.current = true;
      let timer = null;
      // Coalesce bursts (e.g. several photos finishing at once) into one refetch.
      const refresh = () => {
        clearTimeout(timer);
        timer = setTimeout(() => latest.current.reload(), 250);
      };
      const unsubscribe = subscribeLive((event) => {
        if (event.type === 'resync' || latest.current.match(event)) refresh();
      });
      const poll = setInterval(() => {
        if (!live) latest.current.reload();
      }, POLL_MS);
      return () => {
        unsubscribe();
        clearInterval(poll);
        clearTimeout(timer);
      };
    }, []),
  );
}
