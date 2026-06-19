import React, { createContext, useContext, useState, useCallback } from 'react';

interface DraftItem {
  quantity: number;
  isHalf: boolean;
  isCustom: boolean;
}

interface OrderDraft {
  items: Map<number, DraftItem>;
  orderType: 'dine' | 'pack';
  paymentMethod: 'cash' | 'upi' | 'split' | 'pending';
  cashAmount: number;
  upiAmount: number;
}

interface OrderDraftContextType {
  draft: OrderDraft;
  addItem: (menuItemId: number) => void;
  removeItem: (menuItemId: number) => void;
  incrementItem: (menuItemId: number) => void;
  decrementItem: (menuItemId: number) => void;
  setFull: (menuItemId: number) => void;
  setHalf: (menuItemId: number) => void;
  setCustom: (menuItemId: number) => void;
  setOrderType: (type: 'dine' | 'pack') => void;
  setPaymentMethod: (method: 'cash' | 'upi' | 'split' | 'pending') => void;
  setSplitAmounts: (cash: number, upi: number) => void;
  clearDraft: () => void;
  getItemList: () => { menuItemId: number; quantity: number; isHalf: boolean; isCustom: boolean }[];
  getTotalItems: () => number;
}

const OrderDraftContext = createContext<OrderDraftContextType | null>(null);

const defaultDraft: OrderDraft = {
  items: new Map(),
  orderType: 'dine',
  paymentMethod: 'cash',
  cashAmount: 0,
  upiAmount: 0,
};

export function OrderDraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<OrderDraft>(defaultDraft);

  const addItem = useCallback((menuItemId: number) => {
    setDraft((prev) => {
      const next = new Map(prev.items);
      const existing = next.get(menuItemId);
      if (existing) {
        next.set(menuItemId, { ...existing, quantity: existing.quantity + 6 });
      } else {
        next.set(menuItemId, { quantity: 6, isHalf: false, isCustom: false });
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

  const setFull = useCallback((menuItemId: number) => {
    setDraft((prev) => {
      const next = new Map(prev.items);
      const existing = next.get(menuItemId);
      if (existing) {
        next.set(menuItemId, { ...existing, isHalf: false, isCustom: false, quantity: 6 });
      }
      return { ...prev, items: next };
    });
  }, []);

  const setHalf = useCallback((menuItemId: number) => {
    setDraft((prev) => {
      const next = new Map(prev.items);
      const existing = next.get(menuItemId);
      if (existing) {
        next.set(menuItemId, { ...existing, isHalf: true, isCustom: false, quantity: 3 });
      }
      return { ...prev, items: next };
    });
  }, []);

  const setCustom = useCallback((menuItemId: number) => {
    setDraft((prev) => {
      const next = new Map(prev.items);
      const existing = next.get(menuItemId);
      if (existing && !existing.isCustom) {
        next.set(menuItemId, { ...existing, isCustom: true, isHalf: false, quantity: 1 });
      }
      return { ...prev, items: next };
    });
  }, []);

  const setOrderType = useCallback((type: 'dine' | 'pack') => {
    setDraft((prev) => ({ ...prev, orderType: type }));
  }, []);

  const setPaymentMethod = useCallback((method: 'cash' | 'upi' | 'split' | 'pending') => {
    setDraft((prev) => ({ ...prev, paymentMethod: method }));
  }, []);

  const setSplitAmounts = useCallback((cash: number, upi: number) => {
    setDraft((prev) => ({ ...prev, cashAmount: cash, upiAmount: upi }));
  }, []);

  const clearDraft = useCallback(() => {
    setDraft(defaultDraft);
  }, []);

  const getItemList = useCallback(() => {
    const list: { menuItemId: number; quantity: number; isHalf: boolean; isCustom: boolean }[] = [];
    draft.items.forEach((item, menuItemId) => {
      list.push({ menuItemId, quantity: item.quantity, isHalf: item.isHalf, isCustom: item.isCustom });
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
        setFull,
        setHalf,
        setCustom,
        setOrderType,
        setPaymentMethod,
        setSplitAmounts,
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
