import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Button, Fab, Typography, Divider, TextField,
  useTheme, useMediaQuery, Paper, Chip, IconButton
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, CalendarDays, RefreshCw, ChefHat, Receipt, Clock,
  CheckCircle2, AlertTriangle, Truck, Package
} from 'lucide-react';
import { getOrders, completeOrder } from '../api/ordersApi';
import { getSupplyVerification, submitSupplyVerification } from '../api/supplyVerificationApi';
import { getClosingStock, submitClosingStock } from '../api/closingStockApi';
import OrderCard from '../components/OrderCard';
import PaymentModal from '../components/PaymentModal';
import PaymentSuccessDecoration from '../components/animations/PaymentSuccessDecoration';
import SkeletonLoader from '../components/animations/SkeletonLoader';
import Toast from '../components/Toast';
import type { Order, SupplyVerification, ClosingStock } from '../types';
import { vibrate, haptics } from '../theme/tokens';

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

  const [verificationItems, setVerificationItems] = useState<Record<number, number>>({});
  const [showVerifyForm, setShowVerifyForm] = useState(false);

  const { data: closingStock } = useQuery<ClosingStock>({
    queryKey: ['closingStock', date],
    queryFn: () => getClosingStock(date!),
    enabled: !!date,
  });

  const [closingStockItems, setClosingStockItems] = useState<Record<number, { packets: number; pieces: number }>>({});
  const [showClosingForm, setShowClosingForm] = useState(false);

  useEffect(() => {
    if (closingStock?.items) {
      const q: Record<number, { packets: number; pieces: number }> = {};
      closingStock.items.forEach((item) => {
        q[item.supplyItemId] = { packets: item.packetsLeft, pieces: item.piecesLeft };
      });
      setClosingStockItems(q);
    }
  }, [closingStock]);

  useEffect(() => {
    if (supplyVerification?.items) {
      const q: Record<number, number> = {};
      supplyVerification.items.forEach((item) => {
        q[item.supplyItemId] = item.actualQty ?? item.expectedQty;
      });
      setVerificationItems(q);
    }
  }, [supplyVerification]);

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

  const verifyMutation = useMutation({
    mutationFn: () => {
      if (!supplyVerification) return Promise.reject(new Error('No supply to verify'));
      const items = supplyVerification.items.map((item) => ({
        supplyItemId: item.supplyItemId,
        expectedQty: item.expectedQty,
        actualQty: verificationItems[item.supplyItemId] ?? item.expectedQty,
      }));
      return submitSupplyVerification({ orderDate: date!, items });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['supplyVerification', date] });
      setToast({
        message: result.conflictCount > 0
          ? `Verification submitted. ${result.conflictCount} conflict(s) reported.`
          : 'Supply verified successfully!',
        type: result.conflictCount > 0 ? 'error' : 'success',
      });
      setShowVerifyForm(false);
      vibrate(haptics.success);
    },
    onError: () => {
      setToast({ message: 'Failed to submit verification', type: 'error' });
      vibrate(haptics.error);
    },
  });

  const closingStockMutation = useMutation({
    mutationFn: () => {
      if (!closingStock) return Promise.reject(new Error('No supply items to record'));
      const items = closingStock.items.map((item) => ({
        supplyItemId: item.supplyItemId,
        packetsLeft: closingStockItems[item.supplyItemId]?.packets ?? 0,
        piecesLeft: closingStockItems[item.supplyItemId]?.pieces ?? 0,
      }));
      return submitClosingStock({ orderDate: date!, items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closingStock', date] });
      setToast({ message: 'Closing stock saved!', type: 'success' });
      setShowClosingForm(false);
      vibrate(haptics.success);
    },
    onError: () => {
      setToast({ message: 'Failed to save closing stock', type: 'error' });
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
      <Box sx={{ minHeight: 'calc(100vh - 56px)', backgroundColor: 'background.default', p: { xs: 1, md: 2 }, pb: { xs: 8, md: 6 } }}>
        <Box sx={{ maxWidth: { xs: '100%', md: 900 }, mx: 'auto' }}>
          <SkeletonLoader count={3} height={48} />
          <Box sx={{ mt: { xs: 1.5, md: 2 } }}>
            <SkeletonLoader count={4} height={80} />
          </Box>
        </Box>
      </Box>
    );
  }

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

        {/* Supply Verification */}
        {supplyVerification && supplyVerification.items.length > 0 && (
          <Box sx={{ mb: { xs: 1.5, md: 2 } }}>
            <Paper
              sx={{
                borderRadius: { xs: 1, md: 1.5 },
                overflow: 'hidden',
                border: '1px solid',
                borderColor: supplyVerification.isFullyVerified
                  ? (supplyVerification.conflictCount > 0 ? 'error.main' : 'success.main')
                  : 'divider',
                background: isDark
                  ? (supplyVerification.isFullyVerified
                    ? (supplyVerification.conflictCount > 0 ? 'rgba(220,38,38,0.08)' : 'rgba(45,138,78,0.08)')
                    : 'linear-gradient(135deg, #1E1E26 0%, #252530 100%)')
                  : (supplyVerification.isFullyVerified
                    ? (supplyVerification.conflictCount > 0 ? '#FEF2F2' : '#F0FDF4')
                    : undefined),
              }}
            >
              <Box sx={{ p: { xs: 1.25, md: 1.5 }, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 0.75 } }}>
                  <Truck size={16} color={supplyVerification.conflictCount > 0 ? '#DC2626' : (supplyVerification.isFullyVerified ? '#16A34A' : '#9CA3AF')} />
                  <Typography sx={{ fontWeight: 700, fontSize: { xs: '0.85rem', md: '1rem' }, color: 'text.primary' }}>
                    Supply Verification
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {supplyVerification.isFullyVerified ? (
                    <Chip
                      size="small"
                      icon={supplyVerification.conflictCount > 0 ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                      label={supplyVerification.conflictCount > 0 ? `${supplyVerification.conflictCount} Conflict` : 'Verified'}
                      color={supplyVerification.conflictCount > 0 ? 'error' : 'success'}
                      sx={{ fontWeight: 700, height: { xs: 20, md: 24 }, fontSize: { xs: '0.65rem', md: '0.75rem' } }}
                    />
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        vibrate(haptics.light);
                        setShowVerifyForm(!showVerifyForm);
                      }}
                      sx={{ textTransform: 'none', fontWeight: 600, fontSize: { xs: '0.7rem', md: '0.75rem' }, borderRadius: 1, minWidth: 0, px: { xs: 1, md: 1.5 } }}
                    >
                      {showVerifyForm ? 'Close' : 'Verify'}
                    </Button>
                  )}
                </Box>
              </Box>

              <Box sx={{ p: { xs: 1.25, md: 1.5 }, pt: { xs: 0.75, md: 1 } }}>
                {supplyVerification.items.map((item) => (
                  <Box
                    key={item.supplyItemId}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      py: { xs: 0.75, md: 1 },
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:last-child': { borderBottom: 0 },
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: { xs: '0.8rem', md: '0.9rem' }, color: 'text.primary' }}>
                        {item.displayName}
                      </Typography>
                      <Typography sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' }, color: 'text.secondary' }}>
                        Expected: {item.expectedQty} {item.category === 'momo_packet' ? 'pkt' : 'pack'}
                        {item.category === 'momo_packet' && ` · ${item.expectedQty * item.piecesPer} pcs`}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 1.5 } }}>
                      {showVerifyForm ? (
                        <Box
                          component="input"
                          type="number"
                          value={verificationItems[item.supplyItemId] ?? ''}
                          placeholder={String(item.expectedQty)}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setVerificationItems((prev) => ({
                              ...prev,
                              [item.supplyItemId]: isNaN(val) ? 0 : val,
                            }));
                          }}
                          sx={{
                            width: 56,
                            textAlign: 'center',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            py: 0.5,
                            px: 0,
                            border: `1px solid ${(verificationItems[item.supplyItemId] ?? item.expectedQty) !== item.expectedQty ? '#DC2626' : theme.palette.divider}`,
                            borderRadius: 1,
                            background: 'transparent',
                            color: (verificationItems[item.supplyItemId] ?? item.expectedQty) !== item.expectedQty ? '#DC2626' : 'inherit',
                            outline: 'none',
                            '&::-webkit-inner-spin-button, &::-webkit-outer-spin-button': { WebkitAppearance: 'none' },
                            '-moz-appearance': 'textfield',
                          }}
                        />
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography sx={{
                            fontWeight: 700,
                            fontSize: { xs: '0.85rem', md: '1rem' },
                            color: item.hasConflict ? 'error.main' : (item.actualQty !== null ? 'success.main' : 'text.secondary'),
                          }}>
                            {item.actualQty !== null ? item.actualQty : '—'}
                          </Typography>
                          <Typography sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' }, color: 'text.secondary' }}>
                            {item.category === 'momo_packet' ? 'pkt' : 'pack'}
                          </Typography>
                          {item.hasConflict && (
                            <AlertTriangle size={14} color="#DC2626" />
                          )}
                        </Box>
                      )}
                    </Box>
                  </Box>
                ))}

                {showVerifyForm && (
                  <Box sx={{ mt: { xs: 1, md: 1.5 }, display: 'flex', gap: { xs: 1, md: 1.5 } }}>
                    <Button
                      fullWidth
                      variant="contained"
                      size="small"
                      disabled={verifyMutation.isPending}
                      onClick={() => verifyMutation.mutate()}
                      startIcon={<CheckCircle2 size={14} />}
                      sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1, fontSize: { xs: '0.75rem', md: '0.85rem' } }}
                    >
                      {verifyMutation.isPending ? 'Submitting...' : 'Submit Verification'}
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        setVerificationItems({});
                        setShowVerifyForm(false);
                      }}
                      sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1, fontSize: { xs: '0.75rem', md: '0.85rem' } }}
                    >
                      Cancel
                    </Button>
                  </Box>
                )}
              </Box>
            </Paper>
          </Box>
        )}

        {/* Closing Stock */}
        {closingStock && closingStock.items.length > 0 && (
          <Box sx={{ mb: { xs: 1.5, md: 2 } }}>
            <Paper
              sx={{
                borderRadius: { xs: 1, md: 1.5 },
                overflow: 'hidden',
                border: '1px solid',
                borderColor: closingStock.isSubmitted ? 'success.main' : 'divider',
                background: isDark
                  ? (closingStock.isSubmitted ? 'rgba(45,138,78,0.08)' : 'linear-gradient(135deg, #1E1E26 0%, #252530 100%)')
                  : (closingStock.isSubmitted ? '#F0FDF4' : undefined),
              }}
            >
              <Box sx={{ p: { xs: 1.25, md: 1.5 }, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 0.75 } }}>
                  <Package size={16} color={closingStock.isSubmitted ? '#16A34A' : '#9CA3AF'} />
                  <Typography sx={{ fontWeight: 700, fontSize: { xs: '0.85rem', md: '1rem' }, color: 'text.primary' }}>
                    Closing Stock
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {closingStock.isSubmitted ? (
                    <Chip
                      size="small"
                      icon={<CheckCircle2 size={14} />}
                      label="Recorded"
                      color="success"
                      sx={{ fontWeight: 700, height: { xs: 20, md: 24 }, fontSize: { xs: '0.65rem', md: '0.75rem' } }}
                    />
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        vibrate(haptics.light);
                        setShowClosingForm(!showClosingForm);
                      }}
                      sx={{ textTransform: 'none', fontWeight: 600, fontSize: { xs: '0.7rem', md: '0.75rem' }, borderRadius: 1, minWidth: 0, px: { xs: 1, md: 1.5 } }}
                    >
                      {showClosingForm ? 'Close' : 'Record'}
                    </Button>
                  )}
                </Box>
              </Box>

              <Box sx={{ p: { xs: 1.25, md: 1.5 }, pt: { xs: 0.75, md: 1 } }}>
                {closingStock.items.map((item) => (
                  <Box
                    key={item.supplyItemId}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      py: { xs: 0.75, md: 1 },
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:last-child': { borderBottom: 0 },
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: { xs: '0.8rem', md: '0.9rem' }, color: 'text.primary' }}>
                        {item.displayName}
                      </Typography>
                      <Typography sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' }, color: 'text.secondary' }}>
                        {item.category === 'momo_packet' ? `${item.piecesPer} pcs per packet` : 'per pack'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 1.5 } }}>
                      {showClosingForm ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 0.75 } }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Box
                              component="input"
                              type="number"
                              value={closingStockItems[item.supplyItemId]?.packets ?? ''}
                              placeholder="0"
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                setClosingStockItems((prev) => ({
                                  ...prev,
                                  [item.supplyItemId]: {
                                    packets: isNaN(val) ? 0 : val,
                                    pieces: prev[item.supplyItemId]?.pieces ?? 0,
                                  },
                                }));
                              }}
                              sx={{
                                width: 48,
                                textAlign: 'center',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                py: 0.5,
                                px: 0,
                                border: `1px solid ${theme.palette.divider}`,
                                borderRadius: 1,
                                background: 'transparent',
                                color: 'inherit',
                                outline: 'none',
                                '&::-webkit-inner-spin-button, &::-webkit-outer-spin-button': { WebkitAppearance: 'none' },
                                '-moz-appearance': 'textfield',
                              }}
                            />
                            <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', mt: 0.25 }}>pkt</Typography>
                          </Box>
                          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>+</Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Box
                              component="input"
                              type="number"
                              value={closingStockItems[item.supplyItemId]?.pieces ?? ''}
                              placeholder="0"
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                setClosingStockItems((prev) => ({
                                  ...prev,
                                  [item.supplyItemId]: {
                                    packets: prev[item.supplyItemId]?.packets ?? 0,
                                    pieces: isNaN(val) ? 0 : Math.min(val, item.piecesPer - 1),
                                  },
                                }));
                              }}
                              sx={{
                                width: 48,
                                textAlign: 'center',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                py: 0.5,
                                px: 0,
                                border: `1px solid ${theme.palette.divider}`,
                                borderRadius: 1,
                                background: 'transparent',
                                color: 'inherit',
                                outline: 'none',
                                '&::-webkit-inner-spin-button, &::-webkit-outer-spin-button': { WebkitAppearance: 'none' },
                                '-moz-appearance': 'textfield',
                              }}
                            />
                            <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', mt: 0.25 }}>pcs</Typography>
                          </Box>
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: { xs: '0.85rem', md: '1rem' }, color: item.packetsLeft > 0 || item.piecesLeft > 0 ? 'text.primary' : 'text.secondary' }}>
                            {item.packetsLeft > 0 || item.piecesLeft > 0
                              ? `${item.packetsLeft > 0 ? `${item.packetsLeft} pkt` : ''}${item.packetsLeft > 0 && item.piecesLeft > 0 ? ' + ' : ''}${item.piecesLeft > 0 ? `${item.piecesLeft} pcs` : ''}`
                              : '—'}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                ))}

                {showClosingForm && (
                  <Box sx={{ mt: { xs: 1, md: 1.5 }, display: 'flex', gap: { xs: 1, md: 1.5 } }}>
                    <Button
                      fullWidth
                      variant="contained"
                      size="small"
                      disabled={closingStockMutation.isPending}
                      onClick={() => closingStockMutation.mutate()}
                      startIcon={<CheckCircle2 size={14} />}
                      sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1, fontSize: { xs: '0.75rem', md: '0.85rem' } }}
                    >
                      {closingStockMutation.isPending ? 'Saving...' : 'Save Closing Stock'}
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        setClosingStockItems({});
                        setShowClosingForm(false);
                      }}
                      sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1, fontSize: { xs: '0.75rem', md: '0.85rem' } }}
                    >
                      Cancel
                    </Button>
                  </Box>
                )}
              </Box>
            </Paper>
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

          {activeOrders.length === 0 && (
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

          <AnimatePresence>
            {activeOrders.map((order: Order) => (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -16, transition: { duration: 0.2 } }}
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
              <AnimatePresence>
                {completedOrders.map((order: Order) => (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
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
        onResolve={handlePaymentResolve}
        onCancel={() => setPaymentModalOrder(null)}
      />

      <PaymentSuccessDecoration show={showSuccess} onDone={() => setShowSuccess(false)} />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Box>
  );
}
