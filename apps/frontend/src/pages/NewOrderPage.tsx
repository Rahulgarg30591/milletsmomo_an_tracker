import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, ChefHat } from 'lucide-react';
import { getMenu } from '../api/menuApi';
import { createOrder } from '../api/ordersApi';
import { OrderDraftProvider, useOrderDraft } from '../context/OrderDraftContext';
import MenuGrid from '../components/MenuGrid';
import OrderConfigPanel from '../components/OrderConfigPanel';
import SelectedItemsList from '../components/SelectedItemsList';
import TotalBar from '../components/TotalBar';
import Toast from '../components/Toast';
import { vibrate, haptics } from '../theme/tokens';

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
      items,
    });
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', pb: 12, pt: 1 }}>
      <Box sx={{ maxWidth: 700, mx: 'auto', p: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
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
                fontSize: '1.25rem',
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
            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 0.25 }}>
              {date}
            </Typography>
          </Box>
        </Box>

        {/* Menu Grid */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          <MenuGrid menuItems={menuData?.items || []} />
        </motion.div>

        {/* Order Config */}
        <Box sx={{ mt: 3, mb: 2 }}>
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
