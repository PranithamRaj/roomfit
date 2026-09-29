import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

const EMPTY = { items: [], count: 0, subtotal: 0 };
const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { isBuyer } = useAuth();
  const [cart, setCart] = useState(EMPTY);

  const refresh = useCallback(async () => {
    if (!isBuyer) return;
    const res = await api.cart();
    setCart(res.cart);
  }, [isBuyer]);

  // Load the cart when a shopper signs in.
  useEffect(() => {
    if (!isBuyer) return undefined;
    let live = true;
    api.cart().then((res) => live && setCart(res.cart)).catch(() => {});
    return () => {
      live = false;
    };
  }, [isBuyer]);

  const add = useCallback(async (productId, qty = 1) => {
    const res = await api.addToCart(productId, qty);
    setCart(res.cart);
  }, []);

  const setQty = useCallback(async (productId, qty) => {
    const res = await api.setCartQty(productId, qty);
    setCart(res.cart);
  }, []);

  // Sellers and guests never have a cart, even if stale state lingers from a previous session.
  const visible = isBuyer ? cart : EMPTY;
  const value = useMemo(
    () => ({ cart: visible, add, setQty, refresh, clearLocal: () => setCart(EMPTY) }),
    [visible, add, setQty, refresh],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
