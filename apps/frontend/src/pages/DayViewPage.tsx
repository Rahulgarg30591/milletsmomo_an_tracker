import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Fab, Typography, Divider } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrders, completeOrder, deleteOrder } from '../api/ordersApi';
import OrderCard from '../components/OrderCard';
import PaymentModal from '../components/PaymentModal';
import StatChip from '../components/StatChip';
import Toast from '../components/Toast';
import type { Order } from '../types';

export default function DayViewPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [paymentModalOrder, setPaymentModalOrder] = useState<Order | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Order | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', date],
    queryFn: () => getOrders(date!),
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, paymentMethod }: { id: number; paymentMethod?: 'cash' | 'upi' }) =>
      completeOrder(id, paymentMethod),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', date] });
      setToast('Order completed!');
      setPaymentModalOrder(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', date] });
      setToast('Order removed');
      setDeleteConfirm(null);
    },
  });

  const handleComplete = (order: Order) => {
    if (order.paymentMethod === 'pending') {
      setPaymentModalOrder(order);
    } else {
      completeMutation.mutate({ id: order.id });
    }
  };

  const handlePaymentResolve = (method: 'cash' | 'upi') => {
    if (paymentModalOrder) {
      completeMutation.mutate({ id: paymentModalOrder.id, paymentMethod: method });
    }
  };

  const handleDelete = (order: Order) => {
    setDeleteConfirm(order);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteMutation.mutate(deleteConfirm.id);
    }
  };

  const activeOrders = data?.orders?.filter((o: Order) => !o.isCompleted) || [];
  const completedOrders = data?.orders?.filter((o: Order) => o.isCompleted) || [];
  const totalRevenue = data?.orders?.reduce((sum: number, o: Order) => sum + o.totalAmount, 0) || 0;
  const pendingAmount = data?.orders?.reduce((sum: number, o: Order) => sum + (o.paymentMethod === 'pending' ? o.totalAmount : 0), 0) || 0;

  if (isLoading) {
    return (
      <Box sx={{ minHeight: '100vh', backgroundColor: '#F0F4F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#F0F4F1', pb: 10 }}>
      <Box sx={{ maxWidth: 600, mx: 'auto', p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: '#111827', letterSpacing: '-0.3px' }}>
            {date}
          </Typography>
          <Button
            size="small"
            onClick={() => navigate('/dates')}
            sx={{ textTransform: 'none', fontWeight: 600, color: '#1B6B3A' }}
          >
            Change Date
          </Button>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
          <StatChip label="Orders" value={data?.orders?.length || 0} />
          <StatChip label="Revenue" value={`₹${totalRevenue}`} />
          <StatChip label="Pending" value={`₹${pendingAmount}`} color="#DC2626" />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#374151', mb: 1 }}>
            Active Orders ({activeOrders.length})
          </Typography>
          {activeOrders.length === 0 && (
            <Typography sx={{ color: '#9CA3AF', fontSize: '0.9rem', py: 2 }}>
              No active orders for this date
            </Typography>
          )}
          {activeOrders.map((order: Order) => (
            <OrderCard
              key={order.id}
              order={order}
              onComplete={handleComplete}
              onDelete={handleDelete}
            />
          ))}
        </Box>

        {completedOrders.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#374151', mb: 1 }}>
                Completed ({completedOrders.length})
              </Typography>
              {completedOrders.map((order: Order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onComplete={() => {}}
                  onDelete={handleDelete}
                />
              ))}
            </Box>
          </>
        )}
      </Box>

      <Fab
        color="primary"
        onClick={() => navigate(`/day/${date}/new`)}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          backgroundColor: '#1B6B3A',
          '&:hover': { backgroundColor: '#124D29' },
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          width: 56,
          height: 56,
        }}
      >
        <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#FFFFFF' }}>+</Typography>
      </Fab>

      <PaymentModal
        open={!!paymentModalOrder}
        onResolve={handlePaymentResolve}
        onCancel={() => setPaymentModalOrder(null)}
      />

      {deleteConfirm && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.4)',
            p: 2,
          }}
        >
          <Box
            sx={{
              backgroundColor: '#FFFFFF',
              borderRadius: 4,
              p: 3,
              maxWidth: 320,
              width: '100%',
            }}
          >
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', mb: 1, color: '#111827' }}>
              Remove this order?
            </Typography>
            <Typography sx={{ color: '#6B7280', fontSize: '0.9rem', mb: 3 }}>
              This action cannot be undone.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setDeleteConfirm(null)}
                sx={{ borderRadius: 3, py: 1, textTransform: 'none', fontWeight: 600, borderColor: '#E5E7EB', color: '#374151' }}
              >
                Cancel
              </Button>
              <Button
                fullWidth
                variant="contained"
                onClick={confirmDelete}
                sx={{ borderRadius: 3, py: 1, textTransform: 'none', fontWeight: 700, backgroundColor: '#DC2626', '&:hover': { backgroundColor: '#B91C1C' } }}
              >
                Delete
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </Box>
  );
}
