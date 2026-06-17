import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Button, Fab, Typography, Divider, TextField,
  useTheme, useMediaQuery, Paper, Chip, IconButton
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, CalendarDays, RefreshCw, ChefHat, Receipt, Clock
} from 'lucide-react';
import { getOrders, completeOrder } from '../api/ordersApi';
import OrderCard from '../components/OrderCard';
import PaymentModal from '../components/PaymentModal';
import PaymentSuccessDecoration from '../components/animations/PaymentSuccessDecoration';
import SkeletonLoader from '../components/animations/SkeletonLoader';
import Toast from '../components/Toast';
import type { Order } from '../types';
import { vibrate, haptics } from '../theme/tokens';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
}

function StatCard({ icon, label, value, color = '#1B6B3A' }: StatCardProps) {
  return (
    <Paper
      sx={{
        p: 2,
        borderRadius: 3,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        border: 1,
        borderColor: 'divider',
        transition: 'box-shadow 0.2s ease',
        '&:hover': { boxShadow: (t) => t.shadows[2] },
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${color}14`,
          color: color,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </Typography>
        <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: 'text.primary', lineHeight: 1.2, letterSpacing: '-0.2px' }}>
          {value}
        </Typography>
      </Box>
    </Paper>
  );
}

export default function DayViewPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const [paymentModalOrder, setPaymentModalOrder] = useState<Order | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [showSuccess, setShowSuccess] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['orders', date],
    queryFn: () => getOrders(date!),
    refetchInterval: 30000,
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

  const activeOrders = data?.orders?.filter((o: Order) => !o.isCompleted) || [];
  const completedOrders = data?.orders?.filter((o: Order) => o.isCompleted) || [];

  const pendingAmount = data?.orders?.reduce((sum: number, o: Order) => sum + (o.paymentMethod === 'pending' ? o.totalAmount : 0), 0) || 0;

  const handleManualRefresh = () => {
    vibrate(haptics.light);
    refetch();
  };

  if (isLoading && !data) {
    return (
      <Box sx={{ minHeight: 'calc(100vh - 56px)', backgroundColor: 'background.default', p: 2, pb: 10 }}>
        <Box sx={{ maxWidth: 900, mx: 'auto' }}>
          <SkeletonLoader count={3} height={56} />
          <Box sx={{ mt: 3 }}>
            <SkeletonLoader count={4} height={100} />
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: 'calc(100vh - 56px)', backgroundColor: 'background.default', pb: isDesktop ? 4 : 10, pt: 1 }}>
      <Box sx={{ maxWidth: 900, mx: 'auto', p: 2 }}>
        {/* Top bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarDays size={18} color={theme.palette.primary.main} />
            <TextField
              type="date"
              value={date || ''}
              onChange={(e) => {
                const newDate = e.target.value;
                if (newDate) navigate(`/day/${newDate}`);
              }}
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  fontWeight: 800,
                  fontSize: '1.05rem',
                  color: 'text.primary',
                  py: 0.2,
                  px: 0.5,
                  width: { xs: 155, sm: 175 },
                },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                '& .MuiInputBase-input::-webkit-calendar-picker-indicator': {
                  cursor: 'pointer',
                  filter: (t) => t.palette.mode === 'dark' ? 'invert(1)' : 'none',
                },
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
              {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Typography>
            <IconButton
              size="small"
              onClick={handleManualRefresh}
              sx={{ color: 'text.secondary' }}
            >
              <RefreshCw size={16} />
            </IconButton>
            <Button
              variant="contained"
              size="small"
              startIcon={<Plus size={16} />}
              onClick={() => {
                vibrate(haptics.medium);
                navigate(`/day/${date}/new`);
              }}
              sx={{
                borderRadius: 3,
                textTransform: 'none',
                fontWeight: 700,
                px: 2,
                display: { xs: 'none', md: 'flex' },
              }}
            >
              New Order
            </Button>
          </Box>
        </Box>

        {/* Stats */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 1.5,
            mb: 3,
          }}
        >
          <StatCard
            icon={<Receipt size={18} />}
            label="Orders"
            value={data?.orders?.length || 0}
            color="#1B6B3A"
          />

          <StatCard
            icon={<Clock size={18} />}
            label="Pending"
            value={`₹${pendingAmount}`}
            color={pendingAmount > 0 ? '#DC2626' : '#6B7280'}
          />
          <StatCard
            icon={<ChefHat size={18} />}
            label="Active"
            value={activeOrders.length}
            color="#1D4ED8"
          />
        </Box>

        {/* Active Orders */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'success.main' }} />
            <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary' }}>
              Active Orders
            </Typography>
            <Chip
              label={activeOrders.length}
              size="small"
              color="success"
              sx={{ fontWeight: 700, height: 22, fontSize: '0.75rem' }}
            />
          </Box>

          {activeOrders.length === 0 && (
            <Paper
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
              <Typography sx={{ color: 'text.secondary', fontSize: '1rem', fontWeight: 600, mb: 0.5 }}>
                No active orders
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                Tap "New Order" to get started
              </Typography>
            </Paper>
          )}

          <AnimatePresence>
            {activeOrders.map((order: Order) => (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              >
                <OrderCard
                  order={order}
                  onComplete={handleComplete}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </Box>

        {/* Completed Orders */}
        {completedOrders.length > 0 && (
          <>
            <Divider sx={{ my: 3, borderColor: 'divider' }} />
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'grey.400' }} />
                <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary' }}>
                  Completed
                </Typography>
                <Chip
                  label={completedOrders.length}
                  size="small"
                  sx={{ fontWeight: 700, height: 22, fontSize: '0.75rem', backgroundColor: 'grey.100', color: 'grey.600' }}
                />
              </Box>
              <AnimatePresence>
                {completedOrders.map((order: Order) => (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  >
                    <OrderCard
                      order={order}
                      onComplete={() => {}}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </Box>
          </>
        )}
      </Box>

      {/* Mobile FAB */}
      {!isDesktop && (
        <Fab
          color="primary"
          onClick={() => {
            vibrate(haptics.medium);
            navigate(`/day/${date}/new`);
          }}
          sx={{
            position: 'fixed',
            bottom: 80,
            right: 24,
            width: 56,
            height: 56,
            zIndex: 1000,
            boxShadow: '0 4px 16px rgba(27,107,58,0.3)',
          }}
        >
          <Plus size={24} color="#FFFFFF" />
        </Fab>
      )}

      {/* Desktop FAB — top right, sticky */}
      {isDesktop && (
        <Fab
          color="primary"
          onClick={() => {
            vibrate(haptics.medium);
            navigate(`/day/${date}/new`);
          }}
          sx={{
            position: 'fixed',
            top: 80,
            right: 32,
            width: 56,
            height: 56,
            zIndex: 1000,
            boxShadow: '0 4px 16px rgba(27,107,58,0.3)',
          }}
        >
          <Plus size={24} color="#FFFFFF" />
        </Fab>
      )}

      <PaymentModal
        open={!!paymentModalOrder}
        onResolve={handlePaymentResolve}
        onCancel={() => setPaymentModalOrder(null)}
      />

      <PaymentSuccessDecoration show={showSuccess} onDone={() => setShowSuccess(false)} />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Box>
  );
}
