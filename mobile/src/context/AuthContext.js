import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setAuthToken } from '../lib/api';

const TOKEN_KEY = 'roomfit.token';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [shop, setShop] = useState(null);
  const [ready, setReady] = useState(false);

  const applySession = useCallback(async (token, nextUser) => {
    setAuthToken(token);
    await AsyncStorage.setItem(TOKEN_KEY, token);
    setUser(nextUser);
    if (nextUser.role === 'seller') {
      const me = await api.me();
      setShop(me.shop);
    } else {
      setShop(null);
    }
  }, []);

  // Restore a saved session on launch.
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        if (token) {
          setAuthToken(token);
          const me = await api.me();
          setUser(me.user);
          setShop(me.shop);
        }
      } catch (e) {
        // Only drop the token if the server rejected it, not if it was unreachable.
        if (e.status === 401) {
          setAuthToken(null);
          await AsyncStorage.removeItem(TOKEN_KEY);
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const { token, user: u } = await api.login(email, password);
    await applySession(token, u);
  }, [applySession]);

  const register = useCallback(async (payload) => {
    const { token, user: u } = await api.register(payload);
    await applySession(token, u);
  }, [applySession]);

  const logout = useCallback(async () => {
    setAuthToken(null);
    await AsyncStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setShop(null);
  }, []);

  const refreshShop = useCallback(async () => {
    const me = await api.me();
    setShop(me.shop);
    return me.shop;
  }, []);

  const value = useMemo(
    () => ({
      user, shop, ready, login, register, logout, refreshShop,
      isSeller: user?.role === 'seller',
      isBuyer: user?.role === 'buyer',
      isAdmin: user?.role === 'admin',
    }),
    [user, shop, ready, login, register, logout, refreshShop],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
