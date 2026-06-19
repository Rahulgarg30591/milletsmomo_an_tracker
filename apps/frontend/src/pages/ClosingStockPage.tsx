import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Button, Typography, Paper, useTheme, IconButton,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, CheckCircle2, Package, Minus, Plus,
} from 'lucide-react';
import { getClosingStock, submitClosingStock } from '../api/closingStockApi';
import Toast from '../components/Toast';
import { vibrate, haptics } from '../theme/tokens';
import type { ClosingStock } from '../types';

export default function ClosingStockPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const { date } = useParams<{ date: string }>();
  const qc = useQueryClient();
  const targetDate = date || '';

  const [closingItems, setClosingItems] = useState<Record<number, { packets: number; pieces: number }>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { data: closingStock } = useQuery<ClosingStock>({
    queryKey: ['closingStock', targetDate],
    queryFn: () => getClosingStock(targetDate),
    enabled: !!targetDate,
  });

  useEffect(() => {
    if (closingStock?.items) {
      const q: Record<number, { packets: number; pieces: number }> = {};
      closingStock.items.forEach((item) => {
        q[item.supplyItemId] = { packets: item.packetsLeft, pieces: item.piecesLeft };
      });
      setClosingItems(q);
    }
  }, [closingStock]);

  const closingStockMutation = useMutation({
    mutationFn: () => {
      if (!closingStock) return Promise.reject(new Error('No supply items to record'));
      const items = closingStock.items.map((item) => ({
        supplyItemId: item.supplyItemId,
        packetsLeft: closingItems[item.supplyItemId]?.packets ?? 0,
        piecesLeft: closingItems[item.supplyItemId]?.pieces ?? 0,
      }));
      return submitClosingStock({ orderDate: targetDate, items });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['closingStock', targetDate] });
      setToast({ message: 'Closing stock saved!', type: 'success' });
      vibrate(haptics.success);
    },
    onError: () => {
      setToast({ message: 'Failed to save closing stock', type: 'error' });
      vibrate(haptics.error);
    },
  });

  const updatePackets = (id: number, delta: number) => {
    vibrate(haptics.light);
    setClosingItems((prev) => {
      const current = prev[id]?.packets ?? 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [id]: { ...(prev[id] ?? { pieces: 0 }), packets: next } };
    });
  };

  const updatePieces = (id: number, delta: number, maxPieces: number) => {
    vibrate(haptics.light);
    setClosingItems((prev) => {
      const current = prev[id]?.pieces ?? 0;
      const next = Math.max(0, Math.min(maxPieces - 1, current + delta));
      return { ...prev, [id]: { ...(prev[id] ?? { packets: 0 }), pieces: next } };
    });
  };

  const setPackets = (id: number, val: string) => {
    const num = parseInt(val, 10);
    setClosingItems((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { pieces: 0 }), packets: isNaN(num) ? 0 : num } }));
  };

  const setPieces = (id: number, val: string, maxPieces: number) => {
    const num = parseInt(val, 10);
    setClosingItems((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { packets: 0 }), pieces: isNaN(num) ? 0 : Math.min(num, maxPieces - 1) } }));
  };

  if (!closingStock || closingStock.items.length === 0) {
    return (
      <Box sx={{ minHeight: 'calc(100vh - 56px)', backgroundColor: 'background.default', p: { xs: 1, md: 2 } }}>
        <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, textAlign: 'center' }}>
          <Typography sx={{ color: 'text.secondary', fontSize: '1rem', fontWeight: 600 }}>
            No supply order for this date
          </Typography>
          <Button
            sx={{ mt: 2, textTransform: 'none', fontWeight: 600 }}
            startIcon={<ArrowLeft size={16} />}
            onClick={() => navigate(`/day/${targetDate}`)}
          >
            Back
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: 'calc(100vh - 56px)', backgroundColor: 'background.default', p: { xs: 1, md: 2 }, pb: { xs: 8, md: 4 } }}>
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 1.5, md: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 1 } }}>
            <Button
              size="small"
              startIcon={<ArrowLeft size={16} />}
              onClick={() => navigate(`/day/${targetDate}`)}
              sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary', minWidth: 0, px: 1 }}
            >
              Back
            </Button>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: '1rem', md: '1.25rem' }, color: 'text.primary', letterSpacing: '-0.3px' }}>
              Closing Stock
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
            <Package size={14} />
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{targetDate}</Typography>
          </Box>
        </Box>

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
          <Box sx={{ p: { xs: 1.25, md: 1.5 }, borderBottom: 1, borderColor: 'divider' }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Record what's left
            </Typography>
            {closingStock.isSubmitted && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                <CheckCircle2 size={14} color="#16A34A" />
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'success.main' }}>
                  Closing stock recorded
                </Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ p: { xs: 1.25, md: 1.5 } }}>
            {closingStock.items.map((item) => {
              const current = closingItems[item.supplyItemId] ?? { packets: 0, pieces: 0 };
              return (
                <Box
                  key={item.supplyItemId}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    py: { xs: 1, md: 1.25 },
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:last-child': { borderBottom: 0 },
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: { xs: '0.85rem', md: '0.95rem' }, color: 'text.primary' }}>
                      {item.displayName.replace(/\s*\(\d+\s*Pcs\)/i, '')}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      {item.category === 'momo_packet' ? `${item.piecesPer} pcs per packet` : 'per pack'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 0.75 } }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={() => updatePackets(item.supplyItemId, -1)}
                          sx={{ width: 28, height: 28, border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : theme.palette.divider}`, borderRadius: 1, p: 0 }}
                        >
                          <Minus size={12} />
                        </IconButton>
                        <Box
                          component="input"
                          type="number"
                          value={current.packets}
                          onChange={(e) => setPackets(item.supplyItemId, e.target.value)}
                          sx={{
                            width: 44,
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
                        <IconButton
                          size="small"
                          onClick={() => updatePackets(item.supplyItemId, 1)}
                          sx={{ width: 28, height: 28, border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : theme.palette.divider}`, borderRadius: 1, p: 0 }}
                        >
                          <Plus size={12} />
                        </IconButton>
                      </Box>
                      <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', mt: 0.25 }}>pkt</Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mx: 0.5 }}>+</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={() => updatePieces(item.supplyItemId, -1, item.piecesPer)}
                          sx={{ width: 28, height: 28, border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : theme.palette.divider}`, borderRadius: 1, p: 0 }}
                        >
                          <Minus size={12} />
                        </IconButton>
                        <Box
                          component="input"
                          type="number"
                          value={current.pieces}
                          onChange={(e) => setPieces(item.supplyItemId, e.target.value, item.piecesPer)}
                          sx={{
                            width: 44,
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
                        <IconButton
                          size="small"
                          onClick={() => updatePieces(item.supplyItemId, 1, item.piecesPer)}
                          sx={{ width: 28, height: 28, border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : theme.palette.divider}`, borderRadius: 1, p: 0 }}
                        >
                          <Plus size={12} />
                        </IconButton>
                      </Box>
                      <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', mt: 0.25 }}>pcs</Typography>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Paper>

        <Button
          fullWidth
          variant="contained"
          size="large"
          disabled={closingStockMutation.isPending}
          onClick={() => closingStockMutation.mutate()}
          startIcon={<CheckCircle2 size={18} />}
          sx={{ mt: 2, textTransform: 'none', fontWeight: 700, borderRadius: 2, py: 1.5, fontSize: '0.95rem' }}
        >
          {closingStockMutation.isPending ? 'Saving...' : 'Save Closing Stock'}
        </Button>
      </Box>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Box>
  );
}
