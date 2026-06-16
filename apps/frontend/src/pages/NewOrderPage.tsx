import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, IconButton, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMenu } from '../api/menuApi';
import { createOrder } from '../api/ordersApi';
import { OrderDraftProvider, useOrderDraft } from '../context/OrderDraftContext';
import MenuGrid from '../components/MenuGrid';
import OrderConfigPanel from '../components/OrderConfigPanel';
import SelectedItemsList from '../components/SelectedItemsList';
import TotalBar from '../components/TotalBar';
import Toast from '../components/Toast';

function NewOrderContent() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { draft, clearDraft, getItemList } = useOrderDraft();
  const [toast, setToast] = useState<string | null>(null);

  const { data: menuData } = useQuery({
    queryKey: ['menu'],
    queryFn: getMenu,
  });

  const createMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', date] });
      setToast('Order placed! 🎉');
      clearDraft();
      navigate(`/day/${date}`);
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
    <Box sx={{ minHeight: '100vh', backgroundColor: '#F0F4F1', pb: 12 }}>
      <Box sx={{ maxWidth: 600, mx: 'auto', p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconButton
            onClick={() => navigate(`/day/${date}`)}
            sx={{ mr: 1, color: '#374151' }}
          >
            ←
          </IconButton>
          <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: '#111827', letterSpacing: '-0.3px' }}>
            New Order
          </Typography>
        </Box>

        <Box sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', mb: 1 }}>
          Tap to add • Long press for half plate
        </Box>

        <MenuGrid menuItems={menuData?.items || []} />

        <OrderConfigPanel />

        <SelectedItemsList />
      </Box>

      <TotalBar onSubmit={handleSubmit} />

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
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
