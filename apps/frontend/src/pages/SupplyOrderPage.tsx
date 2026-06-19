import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Button, Typography, Paper, useTheme, IconButton } from '@mui/material';
import { ArrowLeft, Minus, Plus, Save, Truck, History } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupplyItems, getSupplyOrder, getSupplyOrderLogs, saveSupplyOrder } from '../api/supplyApi';
import { getToday } from '../utils/dateUtils';
import Toast from '../components/Toast';
import { vibrate, haptics } from '../theme/tokens';
import type { SupplyItem } from '../types';

export default function SupplyOrderPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const date = searchParams.get('date') || getToday();

  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: ['supplyItems'],
    queryFn: getSupplyItems,
  });

  const { data: existingOrder } = useQuery({
    queryKey: ['supplyOrder', date],
    queryFn: () => getSupplyOrder(date),
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['supplyLogs', date],
    queryFn: () => getSupplyOrderLogs(date),
  });

  useEffect(() => {
    if (existingOrder?.items && existingOrder.items.length > 0) {
      const q: Record<number, number> = {};
      existingOrder.items.forEach((item) => {
        q[item.supplyItemId] = item.quantity;
      });
      setQuantities(q);
    } else {
      setQuantities({});
    }
  }, [existingOrder, date]);

  const momoPackets = useMemo(() => items.filter((i) => i.category === 'momo_packet'), [items]);
  const sauces = useMemo(() => items.filter((i) => i.category === 'sauce' || i.category === 'dip'), [items]);

  const updateQty = (id: number, delta: number) => {
    vibrate(haptics.light);
    setQuantities((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  };

  const setQty = (id: number, val: string) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 0) return;
    setQuantities((prev) => {
      if (num === 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: num };
    });
  };

  const totalCost = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = quantities[item.id] || 0;
      return sum + item.unitPrice * qty;
    }, 0);
  }, [items, quantities]);

  const totalPieces = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = quantities[item.id] || 0;
      return sum + (item.category === 'momo_packet' ? qty * item.piecesPer : 0);
    }, 0);
  }, [items, quantities]);

  const hasItems = Object.keys(quantities).length > 0;

  const saveMutation = useMutation({
    mutationFn: () =>
      saveSupplyOrder({
        orderDate: date,
        items: Object.entries(quantities).map(([id, qty]) => ({
          supplyItemId: Number(id),
          quantity: qty,
        })),
      }),
    onSuccess: () => {
      vibrate(haptics.success);
      setToast({ message: 'Supply order saved!', type: 'success' });
      qc.invalidateQueries({ queryKey: ['supplyOrder', date] });
    },
    onError: () => {
      setToast({ message: 'Failed to save order', type: 'error' });
    },
  });

  const renderSection = (title: string, sectionItems: SupplyItem[]) => (
    <Paper sx={{
      borderRadius: 2,
      overflow: 'hidden',
      mb: 2,
      background: isDark ? 'linear-gradient(135deg, #1E1E26 0%, #252530 100%)' : undefined,
      border: isDark ? '1px solid rgba(255,255,255,0.06)' : undefined,
    }}>
      <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </Typography>
      </Box>
      {sectionItems.map((item) => {
        const qty = quantities[item.id] || 0;
        const lineTotal = qty * item.unitPrice;
        return (
          <Box
            key={item.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              py: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
              '&:last-child': { borderBottom: 0 },
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: 'text.primary' }}>
                {item.displayName}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                ₹{item.unitPrice} per {item.category === 'momo_packet' ? 'packet' : 'pack'}
                {item.category === 'momo_packet' && ` · ${item.piecesPer} pcs`}
              </Typography>
              {qty > 0 && (
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'primary.main', mt: 0.25 }}>
                  ₹{lineTotal.toLocaleString()}
                  {item.category === 'momo_packet' && ` · ${qty * item.piecesPer} pcs`}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton
                size="small"
                onClick={() => updateQty(item.id, -1)}
                sx={{
                  width: 32,
                  height: 32,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : theme.palette.divider}`,
                  borderRadius: 1,
                }}
              >
                <Minus size={14} />
              </IconButton>
              <Box
                component="input"
                type="number"
                value={qty || ''}
                placeholder="0"
                onChange={(e) => setQty(item.id, e.target.value)}
                sx={{
                  width: 48,
                  textAlign: 'center',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  py: 0.5,
                  px: 0,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : theme.palette.divider}`,
                  borderRadius: 1,
                  background: 'transparent',
                  color: 'inherit',
                  outline: 'none',
                  '&::-webkit-inner-spin-button, &::-webkit-outer-spin-button': { WebkitAppearance: 'none' },
                  '-moz-appearance': 'textfield',
                }}
              />
              <IconButton
                size="small"
                onClick={() => updateQty(item.id, 1)}
                sx={{
                  width: 32,
                  height: 32,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : theme.palette.divider}`,
                  borderRadius: 1,
                }}
              >
                <Plus size={14} />
              </IconButton>
            </Box>
          </Box>
        );
      })}
    </Paper>
  );

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', p: 1.5, pb: 2, pt: 1, overflowY: 'auto', '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none' }}>
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              size="small"
              startIcon={<ArrowLeft size={16} />}
              onClick={() => navigate('/admin')}
              sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary', minWidth: 0, px: 1 }}
            >
              Back
            </Button>
            <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', color: 'text.primary', letterSpacing: '-0.3px' }}>
              Supply Order
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
            <Truck size={14} />
            <Box
              component="input"
              type="date"
              value={date}
              onChange={(e) => {
                const newDate = e.target.value;
                if (newDate) navigate(`/admin/supply?date=${newDate}`);
              }}
              sx={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'inherit',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                cursor: 'pointer',
                width: 110,
                p: 0,
                '&::-webkit-calendar-picker-indicator': {
                  filter: isDark ? 'invert(1)' : 'none',
                  opacity: 0.6,
                },
              }}
            />
          </Box>
        </Box>

        {renderSection('Momo Packets', momoPackets)}
        {renderSection('Sauces & Dips', sauces)}

        {hasItems && (
          <Paper sx={{
            borderRadius: 2,
            p: 2,
            mb: 2,
            background: isDark
              ? 'linear-gradient(135deg, rgba(74,222,128,0.08) 0%, rgba(45,138,78,0.04) 100%)'
              : 'linear-gradient(135deg, rgba(27,107,58,0.06) 0%, rgba(45,138,78,0.03) 100%)',
            border: `1px solid ${isDark ? 'rgba(74,222,128,0.2)' : 'rgba(27,107,58,0.15)'}`,
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Cost
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: '1.5rem', color: 'primary.main', letterSpacing: '-0.5px' }}>
                  ₹{totalCost.toLocaleString()}
                </Typography>
              </Box>
              {totalPieces > 0 && (
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.secondary' }}>
                  {totalPieces} momos
                </Typography>
              )}
            </Box>
          </Paper>
        )}

        <Button
          fullWidth
          variant="contained"
          size="large"
          disabled={!hasItems || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          startIcon={<Save size={18} />}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: 2,
            py: 1.5,
            fontSize: '0.95rem',
          }}
        >
          {saveMutation.isPending ? 'Saving...' : existingOrder?.id ? 'Update Order' : 'Save Order'}
        </Button>

        {/* Supply Change Logs */}
        {logs.length > 0 && (
          <Paper sx={{
            borderRadius: 2,
            overflow: 'hidden',
            mt: 2,
            background: isDark ? 'linear-gradient(135deg, #1E1E26 0%, #252530 100%)' : undefined,
            border: isDark ? '1px solid rgba(255,255,255,0.06)' : undefined,
          }}>
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
              <History size={16} style={{ color: isDark ? '#9CA3AF' : '#6B7280' }} />
              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Change Log
              </Typography>
            </Box>
            <Box sx={{ p: 1.5, pt: 0.5 }}>
              {logs.map((log) => {
                const logTime = new Date(log.createdAt);
                const timeStr = logTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                const dateStr = logTime.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                return (
                  <Box
                    key={log.id}
                    sx={{
                      py: 1,
                      borderBottom: 1,
                      borderColor: 'divider',
                      '&:last-child': { borderBottom: 0 },
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{
                          fontWeight: 700,
                          fontSize: '0.7rem',
                          px: 0.75,
                          py: 0.25,
                          borderRadius: 1,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          backgroundColor: log.action === 'CREATE' ? (isDark ? 'rgba(74,222,128,0.15)' : '#D1FAE5') : (isDark ? 'rgba(96,165,250,0.15)' : '#DBEAFE'),
                          color: log.action === 'CREATE' ? (isDark ? '#4ADE80' : '#065F46') : (isDark ? '#60A5FA' : '#1E40AF'),
                        }}>
                          {log.action}
                        </Typography>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'text.primary' }}>
                          {log.displayName}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 500 }}>
                        {dateStr} {timeStr}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.4 }}>
                      {log.itemSummary}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Paper>
        )}
      </Box>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Box>
  );
}