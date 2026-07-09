import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Button, Fab, Typography, Divider, TextField,
  useTheme, useMediaQuery, Paper, Chip, IconButton
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Plus, CalendarDays, RefreshCw, ChefHat, Receipt, Clock,
  Truck, Package, Layers
} from 'lucide-react';
import { getOrders, completeOrder } from '../api/ordersApi';
import { getSupplyVerification } from '../api/supplyVerificationApi';
import { getClosingStock } from '../api/closingStockApi';
import { trackNavigation, trackOrderComplete, trackButtonClick } from '../utils/tracking';
import OrderCard from '../components/OrderCard';
import PaymentModal from '../components/PaymentModal';
import SkeletonLoader from '../components/animations/SkeletonLoader';
import PaymentSuccessDecoration from '../components/animations/PaymentSuccessDecoration';
import Toast from '../components/Toast';
import type { Order, SupplyVerification, ClosingStock } from '../types';
import { vibrate, haptics } from '../theme/tokens';

const noop = () => {};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
}

function StatCard({ icon, label, value, color = '#1B6B3A' }: StatCardProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Paper
      sx={{
        p: { xs: 1.25, md: 1.5 },
        borderRadius: { xs: 1, md: 1.25 },
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1, md: 1.25 },
        border: 1,
        borderColor: 'divider',
      }}
    >
      <Box
        sx={{
          width: { xs: 32, md: 36 },
          height: { xs: 32, md: 36 },
          borderRadius: { xs: 1.5, md: 2 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDark ? `${color}30` : `${color}14`,
          color: color,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontSize: { xs: '0.6rem', md: '0.65rem' }, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </Typography>
        <Typography sx={{ fontWeight: 800, fontSize: { xs: '1rem', md: '1.15rem' }, color: 'text.primary', lineHeight: 1.2, letterSpacing: '-0.2px' }}>
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
  const isDark = theme.palette.mode === 'dark';
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

  const { data: supplyVerification } = useQuery<SupplyVerification>({
    queryKey: ['supplyVerification', date],
    queryFn: () => getSupplyVerification(date!),
    enabled: !!date,
  });

  const { data: closingStock } = useQuery<ClosingStock>({
    queryKey: ['closingStock', date],
    queryFn: () => getClosingStock(date!),
    enabled: !!date,
  });

  useEffect(() => {
    setLastRefresh(new Date());
  }, [data]);

  useEffect(() => {
    const handleOrderError = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setToast({ message: detail?.message || 'Failed to place order', type: 'error' });
      vibrate(haptics.error);
    };
    window.addEventListener('order-error', handleOrderError);
    return () => window.removeEventListener('order-error', handleOrderError);
  }, []);

  const landingHandledRef = useRef<string | null | undefined>(null);

  useEffect(() => {
    if (landingHandledRef.current === date) return;
    landingHandledRef.current = date;

    const marker = sessionStorage.getItem('scrollToOrderId');
    if (marker) sessionStorage.removeItem('scrollToOrderId');

    if (!marker) {
      window.scrollTo(0, 0);
      return;
    }

    const tryScroll = () => {
      const el = document.querySelector(`[data-order-id="${marker}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
      }
      const cards = document.querySelectorAll('[data-order-id]');
      if (cards.length > 0) {
        (cards[0] as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
      }
      return false;
    };

    if (!tryScroll()) {
      const timer = setTimeout(tryScroll, 300);
      return () => clearTimeout(timer);
    }
  }, [date]);

  const completeMutation = useMutation({
    mutationFn: ({ id, paymentMethod, cashAmount, upiAmount }: { id: number; paymentMethod?: 'cash' | 'upi' | 'split'; cashAmount?: number; upiAmount?: number }) =>
      completeOrder(id, paymentMethod, cashAmount, upiAmount),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['orders', date] });
      const previousData = queryClient.getQueryData(['orders', date]);

      queryClient.setQueryData(['orders', date], (old: any) => {
        if (!old?.orders) return old;
        return {
          ...old,
          orders: old.orders.map((o: Order) => {
            if (o.id !== variables.id) return o;
            let cashAmount = o.cashAmount;
            let upiAmount = o.upiAmount;
            const paymentMethod = variables.paymentMethod || o.paymentMethod;
            if (variables.paymentMethod === 'cash') {
              cashAmount = o.totalAmount;
              upiAmount = 0;
            } else if (variables.paymentMethod === 'upi') {
              cashAmount = 0;
              upiAmount = o.totalAmount;
            } else if (variables.paymentMethod === 'split') {
              cashAmount = variables.cashAmount ?? 0;
              upiAmount = variables.upiAmount ?? 0;
            }
            return { ...o, isCompleted: true, paymentMethod, cashAmount, upiAmount };
          }),
        };
      });

      setPaymentModalOrder(null);
      setShowSuccess(true);
      vibrate(haptics.success);

      return { previousData };
    },
    onSuccess: (_data, variables) => {
      trackOrderComplete(variables.id, { paymentMethod: variables.paymentMethod });
    },
    onError: (_err, _variables, context) => {
      queryClient.setQueryData(['orders', date], context?.previousData);
      setShowSuccess(false);
      setToast({ message: 'Failed to complete order', type: 'error' });
      vibrate(haptics.error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', date] });
    },
  });

  const handleComplete = useCallback((order: Order) => {
    if (order.paymentMethod === 'pending') {
      setPaymentModalOrder(order);
    } else {
      completeMutation.mutate({ id: order.id });
    }
  }, [completeMutation.mutate]);

  const handleEdit = useCallback((order: Order) => {
    navigate(`/day/${date}/edit/${order.id}`);
  }, [navigate, date]);

  const handlePaymentResolve = useCallback((method: 'cash' | 'upi' | 'split', cashAmount?: number, upiAmount?: number) => {
    if (paymentModalOrder) {
      completeMutation.mutate({ id: paymentModalOrder.id, paymentMethod: method, cashAmount, upiAmount });
    }
  }, [paymentModalOrder, completeMutation.mutate]);

  const activeOrders = useMemo(
    () => (data?.orders?.filter((o: Order) => !o.isCompleted) || []).sort((a: Order, b: Order) => b.id - a.id),
    [data],
  );
  const completedOrders = useMemo(
    () => (data?.orders?.filter((o: Order) => o.isCompleted) || []).sort((a: Order, b: Order) => b.id - a.id),
    [data],
  );

  const pendingAmount = useMemo(() => data?.orders?.reduce((sum: number, o: Order) => sum + (o.paymentMethod === 'pending' ? o.totalAmount : 0), 0) || 0, [data]);

  const handleManualRefresh = () => {
    vibrate(haptics.light);
    refetch();
  };

  return (
    <Box sx={{ minHeight: 'calc(100vh - 56px)', backgroundColor: 'background.default', pb: { xs: 8, md: 4 }, pt: { xs: 0.5, md: 1 } }}>
      <Box sx={{ maxWidth: { xs: '100%', md: 900 }, mx: 'auto', p: { xs: 1, md: 2 } }}>
        {/* Top bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 1.5, md: 2 }, flexWrap: 'wrap', gap: { xs: 0.5, md: 1 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 1 } }}>
            <CalendarDays size={16} color={theme.palette.primary.main} />
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
                  borderRadius: 1,
                  fontWeight: 800,
                  fontSize: { xs: '0.95rem', md: '1.05rem' },
                  color: 'text.primary',
                  py: 0.1,
                  px: 0.4,
                  width: { xs: 140, sm: 155, md: 175 },
                },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                '& .MuiInputBase-input::-webkit-calendar-picker-indicator': {
                  cursor: 'pointer',
                  filter: (t) => t.palette.mode === 'dark' ? 'invert(1)' : 'none',
                },
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 1 } }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: { xs: '0.65rem', md: '0.7rem' } }}>
              {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Typography>
            <IconButton
              size="small"
              onClick={handleManualRefresh}
              sx={{ color: 'text.secondary', p: { xs: 0.4, md: 0.5 } }}
            >
              <RefreshCw size={14} />
            </IconButton>
            <Button
              variant="contained"
              size="small"
              startIcon={<Plus size={14} />}
              onClick={() => {
                vibrate(haptics.medium);
                trackButtonClick('day_view', 'new_order_desktop');
                trackNavigation('day_view', `day/${date}/new`, { reason: 'new_order' });
                navigate(`/day/${date}/new`);
              }}
              sx={{
                borderRadius: 1,
                textTransform: 'none',
                fontWeight: 700,
                px: { xs: 1.5, md: 2 },
                py: { xs: 0.5, md: 0.6 },
                fontSize: { xs: '0.75rem', md: '0.85rem' },
                display: { xs: 'none', md: 'flex' },
                minHeight: 0,
                lineHeight: 1.2,
              }}
            >
              New
            </Button>
          </Box>
        </Box>

        {/* Stats */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(3, 1fr)' },
            gap: { xs: 0.75, md: 1 },
            mb: { xs: 1.5, md: 2 },
          }}
        >
          <StatCard
            icon={<Receipt size={14} />}
            label="Orders"
            value={data?.orders?.length || 0}
            color="#4ADE80"
          />

          <StatCard
            icon={<Clock size={14} />}
            label="Pending"
            value={`₹${pendingAmount}`}
            color={pendingAmount > 0 ? '#F87171' : '#9CA3AF'}
          />
          <StatCard
            icon={<ChefHat size={14} />}
            label="Active"
            value={activeOrders.length}
            color="#60A5FA"
          />
        </Box>

        {/* Quick Actions */}
        {(supplyVerification || closingStock) && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              gap: { xs: 0.75, md: 1 },
              mb: { xs: 1.5, md: 2 },
            }}
          >
            {supplyVerification && supplyVerification.items.length > 0 && (
                  <Button
                variant="outlined"
                size="small"
                startIcon={<Truck size={14} />}
                onClick={() => {
                  vibrate(haptics.light);
                  navigate(`/day/${date}/verify`);
                }}
                disabled={supplyVerification.isFullyVerified && supplyVerification.conflictCount === 0}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  borderRadius: 1,
                  py: { xs: 1, md: 1.25 },
                  fontSize: { xs: '0.75rem', md: '0.85rem' },
                  justifyContent: 'flex-start',
                  borderColor: supplyVerification.isFullyVerified
                    ? (supplyVerification.conflictCount > 0 ? 'error.main' : 'success.main')
                    : 'warning.main',
                  color: supplyVerification.isFullyVerified
                    ? (supplyVerification.conflictCount > 0 ? 'error.main' : 'success.main')
                    : 'warning.main',
                  background: isDark
                    ? (supplyVerification.isFullyVerified
                      ? (supplyVerification.conflictCount > 0 ? 'rgba(220,38,38,0.08)' : 'rgba(45,138,78,0.08)')
                      : 'rgba(245,158,11,0.08)')
                    : (supplyVerification.isFullyVerified
                      ? (supplyVerification.conflictCount > 0 ? '#FEF2F2' : '#F0FDF4')
                      : '#FFFBEB'),
                  position: 'relative',
                  overflow: 'visible',
                  '&:disabled': {
                    color: 'text.disabled',
                    borderColor: 'action.disabled',
                    background: 'transparent',
                    cursor: 'not-allowed',
                  },
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', ml: 0.5 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 'inherit' }}>
                    Verify Supply
                  </Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: 'inherit', opacity: 0.8, fontWeight: 500 }}>
                    {supplyVerification.isFullyVerified
                      ? (supplyVerification.conflictCount > 0 ? `${supplyVerification.conflictCount} conflict` : 'Verified')
                      : 'Not verified'}
                  </Typography>
                </Box>
                {!supplyVerification.isFullyVerified && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      backgroundColor: 'warning.main',
                      border: '2px solid',
                      borderColor: 'background.paper',
                    }}
                  />
                )}
              </Button>
            )}
            {supplyVerification?.isFullyVerified && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<Layers size={14} />}
                onClick={() => {
                  vibrate(haptics.light);
                  trackNavigation('day_view', `day/${date}/stock`, { reason: 'view_live_stock' });
                  navigate(`/day/${date}/stock`);
                }}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  borderRadius: 1,
                  py: { xs: 1, md: 1.25 },
                  fontSize: { xs: '0.75rem', md: '0.85rem' },
                  justifyContent: 'flex-start',
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  background: isDark ? 'rgba(27,107,58,0.08)' : '#F0FDF4',
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', ml: 0.5 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 'inherit' }}>
                    Live Stock
                  </Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', fontWeight: 500 }}>
                    View remaining stock
                  </Typography>
                </Box>
              </Button>
            )}
            {closingStock && closingStock.items.length > 0 && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<Package size={14} />}
                onClick={() => {
                  vibrate(haptics.light);
                  navigate(`/day/${date}/closing`);
                }}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  borderRadius: 1,
                  py: { xs: 1, md: 1.25 },
                  fontSize: { xs: '0.75rem', md: '0.85rem' },
                  justifyContent: 'flex-start',
                  borderColor: closingStock.isSubmitted ? 'success.main' : 'divider',
                  color: closingStock.isSubmitted ? 'success.main' : 'text.primary',
                  background: isDark
                    ? (closingStock.isSubmitted ? 'rgba(45,138,78,0.08)' : 'transparent')
                    : (closingStock.isSubmitted ? '#F0FDF4' : 'transparent'),
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', ml: 0.5 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 'inherit' }}>
                    Closing Stock
                  </Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', fontWeight: 500 }}>
                    {closingStock.isSubmitted ? 'Recorded' : 'Not recorded'}
                  </Typography>
                </Box>
              </Button>
            )}
          </Box>
        )}

        {/* Active Orders */}
        <Box sx={{ mb: { xs: 1, md: 1.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 0.75 }, mb: { xs: 1, md: 1.25 } }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'success.main' }} />
            <Typography sx={{ fontWeight: 700, fontSize: { xs: '0.85rem', md: '1rem' }, color: 'text.primary' }}>
              Active
            </Typography>
            <Chip
              label={activeOrders.length}
              size="small"
              color="success"
              sx={{ fontWeight: 700, height: { xs: 20, md: 22 }, fontSize: { xs: '0.65rem', md: '0.75rem' } }}
            />
          </Box>

          {isLoading && !data ? (
            <SkeletonLoader count={3} height={80} />
          ) : activeOrders.length === 0 && (
            <Paper
              sx={{
                textAlign: 'center',
                py: { xs: 4, md: 5 },
                px: { xs: 1, md: 2 },
                borderRadius: { xs: 1, md: 1.5 },
                backgroundColor: 'background.paper',
                border: '1px dashed',
                borderColor: 'divider',
              }}
            >
              <Typography sx={{ color: 'text.secondary', fontSize: { xs: '0.85rem', md: '1rem' }, fontWeight: 600, mb: 0.25 }}>
                No active orders
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: { xs: '0.75rem', md: '0.85rem' } }}>
                Tap "New Order" to start
              </Typography>
            </Paper>
          )}

            {activeOrders.map((order: Order) => (
              <OrderCard
                key={order.id}
                order={order}
                onComplete={handleComplete}
                onEdit={handleEdit}
              />
            ))}
        </Box>

        {/* Completed Orders */}
        {completedOrders.length > 0 && (
          <>
            <Divider sx={{ my: { xs: 1.5, md: 2 }, borderColor: 'divider' }} />
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 0.75 }, mb: { xs: 1, md: 1.25 } }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'grey.400' }} />
                <Typography sx={{ fontWeight: 700, fontSize: { xs: '0.85rem', md: '1rem' }, color: 'text.primary' }}>
                  Completed
                </Typography>
                <Chip
                  label={completedOrders.length}
                  size="small"
                  sx={{ fontWeight: 700, height: { xs: 20, md: 22 }, fontSize: { xs: '0.65rem', md: '0.75rem' }, backgroundColor: 'grey.100', color: 'grey.600' }}
                />
              </Box>
              {completedOrders.map((order: Order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onComplete={noop}
                />
              ))}
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
            trackButtonClick('day_view', 'new_order_mobile');
            trackNavigation('day_view', `day/${date}/new`, { reason: 'new_order' });
            navigate(`/day/${date}/new`);
          }}
          sx={{
            position: 'fixed',
            bottom: 72,
            right: 16,
            width: 48,
            height: 48,
            zIndex: 1000,
            boxShadow: '0 4px 16px rgba(27,107,58,0.3)',
          }}
        >
          <Plus size={20} color="currentColor" />
        </Fab>
      )}

      {/* Desktop FAB */}
      {isDesktop && (
        <Fab
          color="primary"
          onClick={() => {
            vibrate(haptics.medium);
            trackButtonClick('day_view', 'new_order_desktop_fab');
            trackNavigation('day_view', `day/${date}/new`, { reason: 'new_order' });
            navigate(`/day/${date}/new`);
          }}
          sx={{
            position: 'fixed',
            top: 80,
            right: 24,
            width: 48,
            height: 48,
            zIndex: 1000,
            boxShadow: '0 4px 16px rgba(27,107,58,0.3)',
          }}
        >
          <Plus size={20} color="currentColor" />
        </Fab>
      )}

      <PaymentModal
        open={!!paymentModalOrder}
        totalAmount={paymentModalOrder?.totalAmount || 0}
        onResolve={handlePaymentResolve}
        onCancel={() => setPaymentModalOrder(null)}
      />


      <PaymentSuccessDecoration show={showSuccess} onDone={() => setShowSuccess(false)} />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Box>
  );
}
