import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { OrderDraftProvider, useOrderDraft } from '../OrderDraftContext';

const VEG_STEAM = 1;
const PANEER_STEAM = 2;
const COLD_DRINK = 29;

function useDraft() {
  return renderHook(() => useOrderDraft(), {
    wrapper: ({ children }) => <OrderDraftProvider>{children}</OrderDraftProvider>,
  });
}

const qty = (result: any, id: number) => result.current.draft.items.get(id)?.quantity;

describe('OrderDraftContext', () => {
  describe('building the basket', () => {
    it('starts empty, with no type or payment chosen', () => {
      const { result } = useDraft();
      expect(result.current.draft.items.size).toBe(0);
      expect(result.current.draft.orderType).toBeNull();
      expect(result.current.draft.paymentMethod).toBeNull();
    });

    it('adds a momo item as a full plate of six', () => {
      const { result } = useDraft();
      act(() => result.current.addItem(VEG_STEAM));
      expect(qty(result, VEG_STEAM)).toBe(6);
      expect(result.current.draft.items.get(VEG_STEAM)?.isHalf).toBe(false);
    });

    it('adds another plate when the same item is tapped again', () => {
      const { result } = useDraft();
      act(() => result.current.addItem(VEG_STEAM));
      act(() => result.current.addItem(VEG_STEAM));
      expect(qty(result, VEG_STEAM)).toBe(12);
    });

    it('adds a beverage one unit at a time', () => {
      const { result } = useDraft();
      act(() => result.current.addUnit(COLD_DRINK));
      expect(qty(result, COLD_DRINK)).toBe(1);
      act(() => result.current.addUnit(COLD_DRINK));
      expect(qty(result, COLD_DRINK)).toBe(2);
    });

    it('keeps separate lines per menu item', () => {
      const { result } = useDraft();
      act(() => result.current.addItem(VEG_STEAM));
      act(() => result.current.addItem(PANEER_STEAM));
      expect(result.current.draft.items.size).toBe(2);
    });

    it('removes a line', () => {
      const { result } = useDraft();
      act(() => result.current.addItem(VEG_STEAM));
      act(() => result.current.removeItem(VEG_STEAM));
      expect(result.current.draft.items.size).toBe(0);
    });
  });

  describe('adjusting quantities', () => {
    it('steps up and down by one momo', () => {
      const { result } = useDraft();
      act(() => result.current.addItem(VEG_STEAM));
      act(() => result.current.incrementItem(VEG_STEAM));
      expect(qty(result, VEG_STEAM)).toBe(7);
      act(() => result.current.decrementItem(VEG_STEAM));
      expect(qty(result, VEG_STEAM)).toBe(6);
    });

    it('drops the line when the last momo is removed', () => {
      const { result } = useDraft();
      act(() => result.current.addUnit(COLD_DRINK));
      act(() => result.current.decrementItem(COLD_DRINK));
      expect(result.current.draft.items.has(COLD_DRINK)).toBe(false);
    });

    it('switches between the half and full presets', () => {
      const { result } = useDraft();
      act(() => result.current.addItem(VEG_STEAM));
      act(() => result.current.setHalf(VEG_STEAM));
      expect(qty(result, VEG_STEAM)).toBe(3);
      expect(result.current.draft.items.get(VEG_STEAM)?.isHalf).toBe(true);
      act(() => result.current.setFull(VEG_STEAM));
      expect(qty(result, VEG_STEAM)).toBe(6);
      expect(result.current.draft.items.get(VEG_STEAM)?.isHalf).toBe(false);
    });

    it('ignores a step on an item that is not in the basket', () => {
      const { result } = useDraft();
      act(() => result.current.incrementItem(VEG_STEAM));
      expect(result.current.draft.items.size).toBe(0);
    });
  });

  describe('order configuration', () => {
    it('records the order type and payment method', () => {
      const { result } = useDraft();
      act(() => result.current.setOrderType('pack'));
      act(() => result.current.setPaymentMethod('upi'));
      expect(result.current.draft.orderType).toBe('pack');
      expect(result.current.draft.paymentMethod).toBe('upi');
    });

    it('records split amounts', () => {
      const { result } = useDraft();
      act(() => result.current.setPaymentMethod('split'));
      act(() => result.current.setSplitAmounts(50, 39));
      expect(result.current.draft.cashAmount).toBe(50);
      expect(result.current.draft.upiAmount).toBe(39);
    });

    it('keeps a comment', () => {
      const { result } = useDraft();
      act(() => result.current.setComment('no chilli'));
      expect(result.current.draft.comment).toBe('no chilli');
    });

    it('clears a validation error once the field is filled', () => {
      const { result } = useDraft();
      act(() => result.current.setValidationErrors({ type: true, payment: true }));
      act(() => result.current.clearValidationError('type'));
      expect(result.current.validationErrors.type).toBe(false);
      expect(result.current.validationErrors.payment).toBe(true);
    });
  });

  describe('clearDraft', () => {
    it('empties everything so the next order starts clean', () => {
      const { result } = useDraft();
      act(() => {
        result.current.addItem(VEG_STEAM);
        result.current.setOrderType('dine');
        result.current.setPaymentMethod('cash');
        result.current.setComment('note');
      });
      act(() => result.current.clearDraft());
      expect(result.current.draft.items.size).toBe(0);
      expect(result.current.draft.orderType).toBeNull();
      expect(result.current.draft.paymentMethod).toBeNull();
      expect(result.current.draft.comment).toBeNull();
    });
  });

  describe('loadFromOrder', () => {
    it('reconstructs a draft from an existing order for editing', () => {
      const { result } = useDraft();
      act(() => result.current.loadFromOrder({
        orderType: 'pack',
        paymentMethod: 'cash',
        cashAmount: 89,
        upiAmount: 0,
        comment: 'extra sauce',
        items: [{ menuItemId: VEG_STEAM, quantity: 6, isHalf: false }],
      } as never));
      expect(result.current.draft.orderType).toBe('pack');
      expect(result.current.draft.comment).toBe('extra sauce');
      expect(qty(result, VEG_STEAM)).toBe(6);
    });
  });
});
