import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

// Runs `fn` on mount (and whenever deps change); `reload` re-runs it without blanking data.
// Pass { refetchOnFocus: true } for screens whose data changes elsewhere (cart, orders).
export function useAsync(fn, deps = [], { refetchOnFocus = false } = {}) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: s.data === null, error: null }));
    try {
      const data = await fnRef.current();
      setState({ loading: false, data, error: null });
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error }));
    }
    // Callers pass the values `fn` depends on, like useEffect deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const first = useRef(true);
  useEffect(() => {
    first.current = true;
    reload();
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      if (!refetchOnFocus) return;
      if (first.current) {
        first.current = false; // the mount effect already loaded
        return;
      }
      reload();
    }, [refetchOnFocus, reload]),
  );

  return { ...state, reload };
}
