import React, { createContext, useContext, useState, useCallback } from 'react';

interface DraftItem {
  quantity: number;
  isHalf: boolean;
  isCustom: boolean;
}

interface OrderDraft {
  items: Map<number, DraftItem>;
  orderType: 'dine' | 'pack' | null;
  paymentMethod: 'cash' | 'upi' | 'split' | 'pending' | null;
  cashAmount: number;
  upiAmount: number;
}

interface ValidationErrors {
  type: boolean;
  payment: boolean;
}

interface OrderDraftContextType {
  draft: OrderDraft;
  validationErrors: ValidationErrors;
  setValidationErrors: (errors: ValidationErrors) => void;
  clearValidationError: (field: 'type' | 'payment') => void;
  addItem: (menuItemId: number) => void;
  removeItem: (menuItemId: number) => void;
  incrementItem: (menuItemId: number) => void;
  decrementItem: (menuItemId: number) => void;
  incrementByPlate: (menuItemId: number) => void;
  decrementByPlate: (menuItemId: number) => void;
  setFull: (menuItemId: number) => void;
  setHalf: (menuItemId: number) => void;
  setCustom: (menuItemId: number) => void;
  setOrderType: (type: 'dine' | 'pack') => void;
  setPaymentMethod: (method: 'cash' | 'upi' | 'split' | 'pending') => void;
  setSplitAmounts: (cash: number, upi: number) => void;
  clearDraft: () => void;
  loadFromOrder: (order: {
    orderType: 'dine' | 'pack';
    paymentMethod: 'cash' | 'upi' | 'split' | 'pending';
    cashAmount: number;
    upiAmount: number;
    items: { menuItemId: number; quantity: number; isHalf: boolean }[];
  }) => void;
  getItemList: () => { menuItemId: number; quantity: number; isHalf: boolean; isCustom: boolean }[];
  getTotalItems: () => number;
}

const OrderDraftContext = createContext<OrderDraftContextType | null>(null);

const defaultDraft: OrderDraft = {
  items: new Map(),
  orderType: null,
  paymentMethod: null,
  cashAmount: 0,
  upiAmount: 0,
};

const defaultValidationErrors: ValidationErrors = { type: false, payment: false };

export function OrderDraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<OrderDraft>(defaultDraft);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(defaultValidationErrors);

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
        if (!existing.isHalf && !existing.isCustom) {
          next.set(menuItemId, { ...existing, quantity: existing.quantity + 6 });
        } else {
          next.set(menuItemId, { ...existing, isHalf: false, isCustom: false, quantity: 6 });
        }
      }
      return { ...prev, items: next };
    });
  }, []);

  const setHalf = useCallback((menuItemId: number) => {
    setDraft((prev) => {
      const next = new Map(prev.items);
      const existing = next.get(menuItemId);
      if (existing) {
        if (existing.isHalf && !existing.isCustom) {
          next.set(menuItemId, { ...existing, quantity: existing.quantity + 3 });
        } else {
          next.set(menuItemId, { ...existing, isHalf: true, isCustom: false, quantity: 3 });
        }
      }
      return { ...prev, items: next };
    });
  }, []);

  const setCustom = useCallback((menuItemId: number) => {
    setDraft((prev) => {
      const next = new Map(prev.items);
      const existing = next.get(menuItemId);
      if (existing) {
        if (existing.isCustom) {
          next.set(menuItemId, { ...existing, quantity: existing.quantity + 1 });
        } else {
          next.set(menuItemId, { ...existing, isCustom: true, isHalf: false, quantity: 1 });
        }
      }
      return { ...prev, items: next };
    });
  }, []);

  const decrementByPlate = useCallback((menuItemId: number) => {
    setDraft((prev) => {
      const next = new Map(prev.items);
      const existing = next.get(menuItemId);
      if (!existing) return prev;
      const step = existing.isHalf ? 3 : existing.isCustom ? 1 : 6;
      const newQty = existing.quantity - step;
      if (newQty <= 0) {
        next.delete(menuItemId);
      } else {
        next.set(menuItemId, { ...existing, quantity: newQty });
      }
      return { ...prev, items: next };
    });
  }, []);

  const incrementByPlate = useCallback((menuItemId: number) => {
    setDraft((prev) => {
      const next = new Map(prev.items);
      const existing = next.get(menuItemId);
      if (!existing) return prev;
      const step = existing.isHalf ? 3 : existing.isCustom ? 1 : 6;
      next.set(menuItemId, { ...existing, quantity: existing.quantity + step });
      return { ...prev, items: next };
    });
  }, []);

  const clearValidationError = useCallback((field: 'type' | 'payment') => {
    setValidationErrors((prev) => ({ ...prev, [field]: false }));
  }, []);

  const setOrderType = useCallback((type: 'dine' | 'pack') => {
    setDraft((prev) => ({ ...prev, orderType: type }));
    setValidationErrors((prev) => ({ ...prev, type: false }));
  }, []);

  const setPaymentMethod = useCallback((method: 'cash' | 'upi' | 'split' | 'pending') => {
    setDraft((prev) => ({ ...prev, paymentMethod: method }));
    setValidationErrors((prev) => ({ ...prev, payment: false }));
  }, []);

  const setSplitAmounts = useCallback((cash: number, upi: number) => {
    setDraft((prev) => ({ ...prev, cashAmount: cash, upiAmount: upi }));
  }, []);

  const clearDraft = useCallback(() => {
    setDraft(defaultDraft);
    setValidationErrors(defaultValidationErrors);
  }, []);

  const loadFromOrder = useCallback((order: {
    orderType: 'dine' | 'pack';
    paymentMethod: 'cash' | 'upi' | 'split' | 'pending';
    cashAmount: number;
    upiAmount: number;
    items: { menuItemId: number; quantity: number; isHalf: boolean }[];
  }) => {
    const items = new Map<number, DraftItem>();
    for (const item of order.items) {
      const isHalfPreset = item.isHalf && item.quantity === 3;
      const isFullPreset = !item.isHalf && item.quantity === 6;
      items.set(item.menuItemId, {
        quantity: item.quantity,
        isHalf: item.isHalf,
        isCustom: !isHalfPreset && !isFullPreset,
      });
    }
    setDraft({
      items,
      orderType: order.orderType,
      paymentMethod: order.paymentMethod,
      cashAmount: order.cashAmount,
      upiAmount: order.upiAmount,
    });
    setValidationErrors(defaultValidationErrors);
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
        validationErrors,
        setValidationErrors,
        clearValidationError,
        addItem,
        removeItem,
        incrementItem,
        decrementItem,
        incrementByPlate,
        decrementByPlate,
        setFull,
        setHalf,
        setCustom,
        setOrderType,
        setPaymentMethod,
        setSplitAmounts,
        clearDraft,
        loadFromOrder,
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
