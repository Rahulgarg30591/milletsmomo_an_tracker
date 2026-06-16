import React, { createContext, useContext, useState, useCallback } from 'react';

interface DraftItem {
  quantity: number;
  isHalf: boolean;
}

interface OrderDraft {
  items: Map<number, DraftItem>;
  orderType: 'dine' | 'pack';
  paymentMethod: 'cash' | 'upi' | 'pending';
}

interface OrderDraftContextType {
  draft: OrderDraft;
  addItem: (menuItemId: number) => void;
  removeItem: (menuItemId: number) => void;
  incrementItem: (menuItemId: number) => void;
  decrementItem: (menuItemId: number) => void;
  toggleHalf: (menuItemId: number) => void;
  setOrderType: (type: 'dine' | 'pack') => void;
  setPaymentMethod: (method: 'cash' | 'upi' | 'pending') => void;
  clearDraft: () => void;
  getItemList: () => { menuItemId: number; quantity: number; isHalf: boolean }[];
  getTotalItems: () => number;
}

const OrderDraftContext = createContext<OrderDraftContextType | null>(null);

const defaultDraft: OrderDraft = {
  items: new Map(),
  orderType: 'dine',
  paymentMethod: 'cash',
};

export function OrderDraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<OrderDraft>(defaultDraft);

  const addItem = useCallback((menuItemId: number) => {
    setDraft((prev) => {
      const next = new Map(prev.items);
      const existing = next.get(menuItemId);
      if (existing) {
        next.set(menuItemId, { ...existing, quantity: existing.quantity + 1 });
      } else {
        next.set(menuItemId, { quantity: 1, isHalf: false });
      }
      return { ...prev, items: next };
    });
  }, []);

  const removeItem = useCallback((menuItemId: number) => {
    setDraft((prev) => {
      const next = new Map(prev.items);
      next.delete(menuItemId);
      return { ...prev, items: next };
    });
  }, []);

  const incrementItem = useCallback((menuItemId: number) => {
    setDraft((prev) => {
      const next = new Map(prev.items);
      const existing = next.get(menuItemId);
      if (existing) {
        next.set(menuItemId, { ...existing, quantity: existing.quantity + 1 });
      }
      return { ...prev, items: next };
    });
  }, []);

  const decrementItem = useCallback((menuItemId: number) => {
    setDraft((prev) => {
      const next = new Map(prev.items);
      const existing = next.get(menuItemId);
      if (existing) {
        if (existing.quantity <= 1) {
          next.delete(menuItemId);
        } else {
          next.set(menuItemId, { ...existing, quantity: existing.quantity - 1 });
        }
      }
      return { ...prev, items: next };
    });
  }, []);

  const toggleHalf = useCallback((menuItemId: number) => {
    setDraft((prev) => {
      const next = new Map(prev.items);
      const existing = next.get(menuItemId);
      if (existing) {
        next.set(menuItemId, { ...existing, isHalf: !existing.isHalf });
      }
      return { ...prev, items: next };
    });
  }, []);

  const setOrderType = useCallback((type: 'dine' | 'pack') => {
    setDraft((prev) => ({ ...prev, orderType: type }));
  }, []);

  const setPaymentMethod = useCallback((method: 'cash' | 'upi' | 'pending') => {
    setDraft((prev) => ({ ...prev, paymentMethod: method }));
  }, []);

  const clearDraft = useCallback(() => {
    setDraft(defaultDraft);
  }, []);

  const getItemList = useCallback(() => {
    const list: { menuItemId: number; quantity: number; isHalf: boolean }[] = [];
    draft.items.forEach((item, menuItemId) => {
      list.push({ menuItemId, quantity: item.quantity, isHalf: item.isHalf });
    });
    return list;
  }, [draft.items]);

  const getTotalItems = useCallback(() => {
    let total = 0;
    draft.items.forEach((item) => {
      total += item.quantity;
    });
    return total;
  }, [draft.items]);

  return (
    <OrderDraftContext.Provider
      value={{
        draft,
        addItem,
        removeItem,
        incrementItem,
        decrementItem,
        toggleHalf,
        setOrderType,
        setPaymentMethod,
        clearDraft,
        getItemList,
        getTotalItems,
      }}
    >
      {children}
    </OrderDraftContext.Provider>
  );
}

export function useOrderDraft() {
  const ctx = useContext(OrderDraftContext);
  if (!ctx) throw new Error('useOrderDraft must be used within OrderDraftProvider');
  return ctx;
}
