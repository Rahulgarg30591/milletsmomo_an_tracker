import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, IconButton, Typography, useTheme, Chip, Paper } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ArrowLeft, ChefHat, ShoppingCart } from 'lucide-react';
import { getMenu } from '../api/menuApi';
import { createOrder } from '../api/ordersApi';
import { OrderDraftProvider, useOrderDraft } from '../context/OrderDraftContext';
import { trackPageView, trackOrderSubmit, trackNavigation, trackSelection } from '../utils/tracking';
import { calculateLineTotal, calculateOrderTotal, getMenuItem } from '../utils/pricing';
import MenuGrid from '../components/MenuGrid';
import OrderConfigPanel, { OrderConfigPanelHandle } from '../components/OrderConfigPanel';
import SelectedItemsList from '../components/SelectedItemsList';
import TotalBar from '../components/TotalBar';
import Toast from '../components/Toast';
import { vibrate, haptics } from '../theme/tokens';
import type { MenuItem, Order, OrderItem } from '../types';

const CATEGORY_ICONS: Record<string, string> = {
  'Steam': '🍲',
  'Fry': '🍳',
  'Creamy': '🥘',
  'Creamy Fry': '🍤',
  'Nepalese Kothey': '🥟',
  'Pan Fried Gravy': '🍛',
};

const CATEGORY_COLORS_LIGHT: Record<string, { bg: string; border: string; text: string }> = {
  'Steam': { bg: '#E8F5EE', border: '#1B6B3A', text: '#1B6B3A' },
  'Fry': { bg: '#FEF3C7', border: '#D97706', text: '#B45309' },
  'Creamy': { bg: '#F3E8FF', border: '#7C3AED', text: '#6B21A8' },
  'Creamy Fry': { bg: '#FCE7F3', border: '#DB2777', text: '#9D174D' },
  'Nepalese Kothey': { bg: '#ECFDF5', border: '#059669', text: '#047857' },
  'Pan Fried Gravy': { bg: '#EFF6FF', border: '#2563EB', text: '#1D4ED8' },
};

const CATEGORY_COLORS_DARK: Record<string, { bg: string; border: string; text: string }> = {
  'Steam': { bg: '#1A2E20', border: '#2D8A4E', text: '#4ADE80' },
  'Fry': { bg: '#3D2E1A', border: '#D97706', text: '#FBBF24' },
  'Creamy': { bg: '#2E1A4A', border: '#7C3AED', text: '#C4A8E8' },
  'Creamy Fry': { bg: '#3D1A2E', border: '#DB2777', text: '#E8A8C8' },
  'Nepalese Kothey': { bg: '#1A3D2A', border: '#2D8A4E', text: '#8CE8B4' },
  'Pan Fried Gravy': { bg: '#1A2E4A', border: '#2563EB', text: '#8CB4E8' },
};

function NewOrderContent() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { draft, clearDraft, getItemList, setValidationErrors } = useOrderDraft();
  const configPanelRef = useRef<OrderConfigPanelHandle>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const submitContextRef = useRef<{ itemCount: number }>({ itemCount: 0 });
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const CATEGORY_COLORS = isDark ? CATEGORY_COLORS_DARK : CATEGORY_COLORS_LIGHT;

  const { data: menuData } = useQuery({
    queryKey: ['menu'],
    queryFn: getMenu,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const groupedItems = useMemo(() => {
    if (!menuData?.items) return [];
    const groups = new Map<string, MenuItem[]>();
    menuData.items.forEach((item: MenuItem) => {
      const prep = item.preparation || 'Other';
      if (!groups.has(prep)) groups.set(prep, []);
      groups.get(prep)!.push(item);
    });
    return Array.from(groups.entries());
  }, [menuData]);

  const totalSelectedItems = useMemo(() => {
    let total = 0;
    draft.items.forEach((item) => {
      total += item.quantity;
    });
    return total;
  }, [draft.items]);

  useEffect(() => {
    trackPageView('new_order', `Opened new order page for ${date}`);
    window.scrollTo(0, 0);
  }, [date]);

  const createMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: (res) => {
      trackOrderSubmit(res.id, { orderDate: date, itemCount: submitContextRef.current.itemCount });
      trackNavigation('new_order', `day/${date}`, { reason: 'order_created', orderId: res.id });
      queryClient.invalidateQueries({ queryKey: ['orders', date] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', date] });
      vibrate(haptics.error);
      window.dispatchEvent(new CustomEvent('order-error', { detail: { message: 'Failed to place order' } }));
    },
  });

  const handleSubmit = () => {
    const items = getItemList();
    if (items.length === 0) return;

    const errors = {
      type: !draft.orderType,
      payment: !draft.paymentMethod,
    };

    if (errors.type || errors.payment) {
      setValidationErrors(errors);
      vibrate(haptics.error);
      const firstError = errors.type ? 'type' : 'payment';
      configPanelRef.current?.scrollToError(firstError);
      return;
    }

    const totalAmount = calculateOrderTotal(items);

    const optimisticItems: OrderItem[] = items.map((i) => {
      const { unitPrice, lineTotal } = calculateLineTotal(i.menuItemId, i.quantity, i.isHalf, i.isCustom);
      const menuItem = getMenuItem(i.menuItemId);
      return {
        menuItemId: i.menuItemId,
        itemName: menuItem?.displayName || '',
        quantity: i.quantity,
        isHalf: i.isHalf,
        unitPrice,
        lineTotal,
      };
    });

    const optimisticOrder: Order = {
      id: Date.now(),
      orderDate: date!,
      timeLabel: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }),
      orderType: draft.orderType!,
      paymentMethod: draft.paymentMethod!,
      isCompleted: false,
      totalAmount,
      cashAmount: draft.paymentMethod === 'cash' ? totalAmount : draft.paymentMethod === 'split' ? draft.cashAmount : 0,
      upiAmount: draft.paymentMethod === 'upi' ? totalAmount : draft.paymentMethod === 'split' ? draft.upiAmount : 0,
      items: optimisticItems,
    };

    const payload: any = {
      orderDate: date!,
      orderType: draft.orderType,
      paymentMethod: draft.paymentMethod,
      items: items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity, isHalf: i.isHalf })),
    };

    if (draft.paymentMethod === 'split') {
      payload.cashAmount = draft.cashAmount;
      payload.upiAmount = draft.upiAmount;
    }

    queryClient.setQueryData(['orders', date], (old: any) => {
      if (!old) return { orders: [optimisticOrder] };
      return { ...old, orders: [...old.orders, optimisticOrder] };
    });

    submitContextRef.current = { itemCount: items.length };
    sessionStorage.setItem('scrollToOrderId', String(optimisticOrder.id));
    trackSelection('new_order', 'submit', 'confirmed', { itemCount: items.length, totalAmount, orderType: draft.orderType, paymentMethod: draft.paymentMethod });
    clearDraft();
    vibrate(haptics.success);
    navigate(`/day/${date}`);

    createMutation.mutate(payload);
  };

  return (
    <Box sx={{ minHeight: 'calc(100vh - 56px)', backgroundColor: 'background.default', pb: { xs: 14, md: 12 }, pt: 0.25 }}>
      <Box sx={{ maxWidth: { xs: '100%', md: 720 }, mx: 'auto', px: { xs: 0.75, md: 2 }, py: { xs: 0.75, md: 1.5 } }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: { xs: 1, md: 2 }, gap: { xs: 0.5, md: 1 } }}>
          <IconButton
            onClick={() => navigate(`/day/${date}`)}
            sx={{ color: 'text.secondary', p: { xs: 0.5, md: 0.75 }, mr: { xs: 0.25, md: 0.5 } }}
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: { xs: '1rem', md: '1.25rem' },
                color: 'text.primary',
                letterSpacing: '-0.3px',
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 0.5, md: 0.75 },
              }}
            >
              <ChefHat size={18} color={theme.palette.primary.main} />
              New Order
            </Typography>
            <Typography sx={{ fontSize: { xs: '0.7rem', md: '0.8rem' }, color: 'text.secondary', mt: 0.125 }}>
              {date ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }) : ''}
            </Typography>
          </Box>
          {totalSelectedItems > 0 && (
            <Chip
              icon={<ShoppingCart size={12} />}
              label={`${totalSelectedItems} momo${totalSelectedItems > 1 ? 's' : ''}`}
              color="primary"
              size="small"
              sx={{ fontWeight: 700, fontSize: { xs: '0.65rem', md: '0.75rem' }, height: { xs: 22, md: 26 } }}
            />
          )}
        </Box>

        {/* Menu Grid by Category */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 0.75, md: 1.5 } }}>
          {groupedItems.map(([preparation, items], categoryIndex) => {
            const colors = CATEGORY_COLORS[preparation] || { bg: isDark ? '#2A2A32' : '#F3F4F6', border: isDark ? '#9CA3AF' : '#9CA3AF', text: isDark ? '#9CA3AF' : '#4B5563' };
            return (
              <Box key={preparation}>
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 1, md: 1.5 },
                    borderRadius: { xs: 0.75, md: 1 },
                    border: { xs: 1, md: 1.5 },
                    borderColor: colors.border,
                    backgroundColor: colors.bg,
                    mb: { xs: 0.5, md: 1 },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, md: 1 }, mb: { xs: 0.75, md: 1 } }}>
                    <Typography sx={{ fontSize: { xs: '1rem', md: '1.2rem' }, lineHeight: 1 }}>{CATEGORY_ICONS[preparation] || '🍽️'}</Typography>
                    <Typography
                      sx={{
                        fontWeight: 800,
                        fontSize: { xs: '0.8rem', md: '1rem' },
                        color: colors.text,
                        letterSpacing: '-0.2px',
                        textTransform: 'uppercase',
                        lineHeight: 1,
                      }}
                    >
                      {preparation}
                    </Typography>
                  </Box>
                  <MenuGrid items={items} categoryIndex={categoryIndex} />
                </Paper>
              </Box>
            );
          })}
        </Box>

        {/* Order Config */}
        <Box sx={{ mt: { xs: 1.5, md: 2.5 }, mb: { xs: 1, md: 1.5 } }}>
          <OrderConfigPanel ref={configPanelRef} />
        </Box>

        {/* Selected Items Summary */}
        <SelectedItemsList />
      </Box>

      <TotalBar onSubmit={handleSubmit} />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Box>
  );
}

export default function NewOrderPage() {
  return (
    <OrderDraftProvider>
      <NewOrderContent />
    </OrderDraftProvider>
  );
}
