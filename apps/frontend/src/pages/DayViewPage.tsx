import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Fab, Typography, Divider, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, ArrowLeft, CalendarDays, RefreshCw } from 'lucide-react';
import { getOrders, completeOrder, deleteOrder } from '../api/ordersApi';
import OrderCard from '../components/OrderCard';
import PaymentModal from '../components/PaymentModal';
import PaymentSuccessDecoration from '../components/animations/PaymentSuccessDecoration';
import StatChip from '../components/StatChip';
import SkeletonLoader from '../components/animations/SkeletonLoader';
import StaggerContainer, { StaggerItem } from '../components/animations/StaggerContainer';
import Toast from '../components/Toast';
import type { Order } from '../types';
import { vibrate, haptics } from '../theme/tokens';

export default function DayViewPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [paymentModalOrder, setPaymentModalOrder] = useState<Order | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Order | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['orders', date],
    queryFn: () => getOrders(date!),
    refetchInterval: 30000, // Auto-refresh every 30s
  });

  useEffect(() => {
    setLastRefresh(new Date());
  }, [data]);

  const completeMutation = useMutation({
    mutationFn: ({ id, paymentMethod }: { id: number; paymentMethod?: 'cash' | 'upi' }) =>
      completeOrder(id, paymentMethod),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', date] });
      setToast({ message: 'Order completed!', type: 'success' });
      setPaymentModalOrder(null);
      setShowSuccess(true);
      vibrate(haptics.success);
    },
    onError: () => {
      setToast({ message: 'Failed to complete order', type: 'error' });
      vibrate(haptics.error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', date] });
      setToast({ message: 'Order removed', type: 'success' });
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

  const handleManualRefresh = () => {
    vibrate(haptics.light);
    refetch();
  };

  if (isLoading && !data) {
    return (
      <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', p: 2, pb: 10 }}>
        <Box sx={{ maxWidth: 600, mx: 'auto' }}>
          <SkeletonLoader count={3} height={48} sx={{ mb: 2 }} />
          <SkeletonLoader count={5} height={120} sx={{ mb: 1.5 }} />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', pb: 10, pt: 1 }}>
      <Box sx={{ maxWidth: 600, mx: 'auto', p: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              size="small"
              startIcon={<ArrowLeft size={16} />}
              onClick={() => navigate('/dates')}
              sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary', minWidth: 0, px: 1 }}
            >
              Back
            </Button>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CalendarDays size={16} color="currentColor" style={{ opacity: 0.5 }} />
              <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', color: 'text.primary', letterSpacing: '-0.3px' }}>
                {date}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
              Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Typography>
            <Button
              size="small"
              onClick={handleManualRefresh}
              sx={{ minWidth: 0, p: 0.5, color: 'text.secondary' }}
            >
              <RefreshCw size={16} />
            </Button>
          </Box>
        </Box>

        {/* Stats */}
        <StaggerContainer sx={{ display: 'flex', gap: 1.5, mb: 3, overflowX: 'auto', pb: 0.5 }}>
          <StaggerItem>
            <StatChip label="Orders" value={data?.orders?.length || 0} icon="orders" />
          </StaggerItem>
          <StaggerItem>
            <StatChip label="Revenue" value={`₹${totalRevenue}`} icon="revenue" color="accent" />
          </StaggerItem>
          <StaggerItem>
            <StatChip label="Pending" value={`₹${pendingAmount}`} icon="pending" color="error" />
          </StaggerItem>
        </StaggerContainer>

        {/* Active Orders */}
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'text.primary', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'success.main' }} />
            Active Orders ({activeOrders.length})
          </Typography>
          {activeOrders.length === 0 && (
            <Box
              sx={{
                textAlign: 'center',
                py: 6,
                px: 2,
                borderRadius: 4,
                backgroundColor: 'background.paper',
                border: '1px dashed',
                borderColor: 'divider',
              }}
            >
              <Typography sx={{ color: 'text.secondary', fontSize: '0.95rem', fontWeight: 500 }}>
                No active orders for this date
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', mt: 0.5 }}>
                Tap + to create a new order
              </Typography>
            </Box>
          )}
          <StaggerContainer>
            {activeOrders.map((order: Order, idx: number) => (
              <StaggerItem key={order.id}>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05, type: 'spring', stiffness: 400, damping: 30 }}
                >
                  <OrderCard
                    order={order}
                    onComplete={handleComplete}
                    onDelete={handleDelete}
                  />
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </Box>

        {/* Completed Orders */}
        {completedOrders.length > 0 && (
          <>
            <Divider sx={{ my: 2, borderColor: 'divider' }} />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'text.primary', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'grey.400' }} />
                Completed ({completedOrders.length})
              </Typography>
              <StaggerContainer>
                {completedOrders.map((order: Order, idx: number) => (
                  <StaggerItem key={order.id}>
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05, type: 'spring', stiffness: 400, damping: 30 }}
                    >
                      <OrderCard
                        order={order}
                        onComplete={() => {}}
                        onDelete={handleDelete}
                      />
                    </motion.div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </Box>
          </>
        )}
      </Box>

      {/* FAB */}
      <Fab
        color="primary"
        onClick={() => {
          vibrate(haptics.medium);
          navigate(`/day/${date}/new`);
        }}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          boxShadow: '0 4px 16px rgba(27,107,58,0.3)',
          width: 56,
          height: 56,
          zIndex: 1000,
        }}
      >
        <Plus size={24} color="#FFFFFF" />
      </Fab>

      <PaymentModal
        open={!!paymentModalOrder}
        onResolve={handlePaymentResolve}
        onCancel={() => setPaymentModalOrder(null)}
      />

      <PaymentSuccessDecoration show={showSuccess} onDone={() => setShowSuccess(false)} />

      {/* Delete Dialog */}
      <Dialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        PaperProps={{ sx: { borderRadius: 4, mx: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.1rem' }}>Remove this order?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setDeleteConfirm(null)}
            sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDelete}
            sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 700 }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Box>
  );
}