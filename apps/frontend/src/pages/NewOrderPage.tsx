import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, IconButton, Typography, useTheme, Chip, Paper } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, ChefHat, ShoppingCart } from 'lucide-react';
import { getMenu } from '../api/menuApi';
import { createOrder } from '../api/ordersApi';
import { OrderDraftProvider, useOrderDraft } from '../context/OrderDraftContext';
import MenuGrid from '../components/MenuGrid';
import OrderConfigPanel from '../components/OrderConfigPanel';
import SelectedItemsList from '../components/SelectedItemsList';
import TotalBar from '../components/TotalBar';
import Toast from '../components/Toast';
import { vibrate, haptics } from '../theme/tokens';
import type { MenuItem } from '../types';

const CATEGORY_ICONS: Record<string, string> = {
  'Steam': '🍲',
  'Fry': '🍳',
  'Creamy': '🥘',
  'Creamy Fry': '🍤',
  'Nepalese Kothey': '🥟',
  'Pan Fried Gravy': '🍛',
};

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'Steam': { bg: '#E8F5EE', border: '#1B6B3A', text: '#1B6B3A' },
  'Fry': { bg: '#FEF3C7', border: '#D97706', text: '#B45309' },
  'Creamy': { bg: '#F3E8FF', border: '#7C3AED', text: '#6B21A8' },
  'Creamy Fry': { bg: '#FCE7F3', border: '#DB2777', text: '#9D174D' },
  'Nepalese Kothey': { bg: '#ECFDF5', border: '#059669', text: '#047857' },
  'Pan Fried Gravy': { bg: '#EFF6FF', border: '#2563EB', text: '#1D4ED8' },
};

function NewOrderContent() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { draft, clearDraft, getItemList } = useOrderDraft();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const theme = useTheme();

  const { data: menuData } = useQuery({
    queryKey: ['menu'],
    queryFn: getMenu,
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

  const createMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', date] });
      setToast({ message: 'Order placed! 🎉', type: 'success' });
      clearDraft();
      vibrate(haptics.success);
      navigate(`/day/${date}`);
    },
    onError: () => {
      setToast({ message: 'Failed to place order', type: 'error' });
      vibrate(haptics.error);
    },
  });

  const handleSubmit = () => {
    const items = getItemList();
    if (items.length === 0) return;

    createMutation.mutate({
      orderDate: date!,
      orderType: draft.orderType,
      paymentMethod: draft.paymentMethod,
      items: items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity, isHalf: i.isHalf })),
    });
  };

  return (
    <Box sx={{ minHeight: 'calc(100vh - 56px)', backgroundColor: 'background.default', pb: { xs: 18, md: 12 }, pt: 0.5 }}>
      <Box sx={{ maxWidth: 700, mx: 'auto', p: 1.5 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
          <IconButton
            onClick={() => navigate(`/day/${date}`)}
            sx={{ color: 'text.secondary', mr: 0.5 }}
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: '1.15rem',
                color: 'text.primary',
                letterSpacing: '-0.3px',
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
              }}
            >
              <ChefHat size={20} color={theme.palette.primary.main} />
              New Order
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.25 }}>
              {date ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }) : ''}
            </Typography>
          </Box>
          {totalSelectedItems > 0 && (
            <Chip
              icon={<ShoppingCart size={14} />}
              label={`${totalSelectedItems} momo${totalSelectedItems > 1 ? 's' : ''}`}
              color="primary"
              size="small"
              sx={{ fontWeight: 700 }}
            />
          )}
        </Box>

        {/* Menu Grid by Category */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {groupedItems.map(([preparation, items], categoryIndex) => {
            const colors = CATEGORY_COLORS[preparation] || { bg: '#F3F4F6', border: '#9CA3AF', text: '#4B5563' };
            return (
              <motion.div
                key={preparation}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: categoryIndex * 0.08, type: 'spring', stiffness: 400, damping: 30 }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    border: 1.5,
                    borderColor: colors.border,
                    backgroundColor: colors.bg,
                    mb: 1,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography sx={{ fontSize: '1.1rem' }}>{CATEGORY_ICONS[preparation] || '🍽️'}</Typography>
                    <Typography
                      sx={{
                        fontWeight: 800,
                        fontSize: '0.9rem',
                        color: colors.text,
                        letterSpacing: '-0.2px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {preparation}
                    </Typography>
                  </Box>
                  <MenuGrid items={items} categoryIndex={categoryIndex} />
                </Paper>
              </motion.div>
            );
          })}
        </Box>

        {/* Order Config */}
        <Box sx={{ mt: 2, mb: 1.5 }}>
          <OrderConfigPanel />
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
