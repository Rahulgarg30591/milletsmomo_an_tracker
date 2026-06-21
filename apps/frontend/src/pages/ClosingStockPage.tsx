import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Button, Typography, Paper, useTheme, IconButton, TextField, Chip, Collapse,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, CheckCircle2, Package, Minus, Plus, AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { getClosingStock, submitClosingStock } from '../api/closingStockApi';
import { getSupplyVerification } from '../api/supplyVerificationApi';
import { getOrders } from '../api/ordersApi';
import { getMenu } from '../api/menuApi';
import { addDays } from '../utils/dateUtils';
import { trackPageView, trackClosingStockSubmit } from '../utils/tracking';
import Toast from '../components/Toast';
import { vibrate, haptics } from '../theme/tokens';
import type { ClosingStock, SupplyVerification } from '../types';

interface ExpectedStockItem {
  supplyItemId: number;
  displayName: string;
  expectedPackets: number;
  expectedPieces: number;
  expectedTotalPieces: number;
}

export default function ClosingStockPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const { date } = useParams<{ date: string }>();
  const qc = useQueryClient();
  const targetDate = date || '';
  const yesterday = addDays(targetDate, -1);

  const [closingItems, setClosingItems] = useState<Record<number, { packets: number; pieces: number; wastage: number; hasConflict: boolean; conflictReason: string }>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [liveStockExpanded, setLiveStockExpanded] = useState(true);

  const { data: closingStock } = useQuery<ClosingStock>({
    queryKey: ['closingStock', targetDate],
    queryFn: () => getClosingStock(targetDate),
    enabled: !!targetDate,
  });

  const { data: supplyVerification } = useQuery({
    queryKey: ['supplyVerification', targetDate],
    queryFn: () => getSupplyVerification(targetDate),
    enabled: !!targetDate,
  });

  const { data: yesterdayClosing } = useQuery({
    queryKey: ['closingStock', yesterday],
    queryFn: () => getClosingStock(yesterday),
    enabled: !!yesterday,
  });

  const { data: ordersData } = useQuery({
    queryKey: ['orders', targetDate],
    queryFn: () => getOrders(targetDate),
    enabled: !!targetDate,
  });

  const { data: menuData } = useQuery({
    queryKey: ['menu'],
    queryFn: getMenu,
  });

  useEffect(() => {
    trackPageView('closing_stock', `Opened closing stock for ${targetDate}`);
  }, [targetDate]);

  useEffect(() => {
    if (closingStock?.items) {
      const q: Record<number, { packets: number; pieces: number; wastage: number; hasConflict: boolean; conflictReason: string }> = {};
      closingStock.items.forEach((item) => {
        q[item.supplyItemId] = {
          packets: item.packetsLeft,
          pieces: item.piecesLeft,
          wastage: item.wastagePieces,
          hasConflict: item.hasConflict,
          conflictReason: item.conflictReason || '',
        };
      });
      setClosingItems(q);
    }
  }, [closingStock]);

  const expectedStock = useMemo<ExpectedStockItem[]>(() => {
    const menuItems = (menuData?.items || []) as Array<{ id: number; filling: string; displayName: string }>;
    const menuMap = new Map(menuItems.map((mi) => [mi.id, mi]));

    const itemMap = new Map<number, { supplyItemId: number; displayName: string; piecesPer: number; closingTotalPieces: number; supplyTotalPieces: number }>();

    for (const cItem of yesterdayClosing?.items || []) {
      if (cItem.category !== 'momo_packet') continue;
      const piecesPer = cItem.piecesPer || 24;
      itemMap.set(cItem.supplyItemId, {
        supplyItemId: cItem.supplyItemId,
        displayName: cItem.displayName,
        piecesPer,
        closingTotalPieces: cItem.packetsLeft * piecesPer + cItem.piecesLeft,
        supplyTotalPieces: 0,
      });
    }

    for (const vItem of (supplyVerification as SupplyVerification | null)?.items || []) {
      if (vItem.category !== 'momo_packet') continue;
      const piecesPer = vItem.piecesPer || 24;
      const supplyQty = vItem.actualQty ?? vItem.expectedQty;
      const supplyTotalPieces = supplyQty * piecesPer;
      const existing = itemMap.get(vItem.supplyItemId);
      if (existing) {
        existing.supplyTotalPieces = supplyTotalPieces;
      } else {
        itemMap.set(vItem.supplyItemId, {
          supplyItemId: vItem.supplyItemId,
          displayName: vItem.displayName,
          piecesPer,
          closingTotalPieces: 0,
          supplyTotalPieces,
        });
      }
    }

    const orders = ordersData?.orders || [];
    const items: ExpectedStockItem[] = [];

    for (const si of itemMap.values()) {
      const piecesPer = si.piecesPer;
      const fullFilling = si.displayName.includes('Cheese Corn') ? 'Cheese Corn' : si.displayName.split(' ')[0];

      const openingTotalPieces = si.closingTotalPieces + si.supplyTotalPieces;
      let consumedPieces = 0;
      for (const order of orders) {
        for (const orderItem of order.items) {
          const menuItem = menuMap.get(orderItem.menuItemId);
          if (!menuItem) continue;
          const itemFilling = menuItem.filling;
          const quantity = orderItem.quantity;
          if (itemFilling === fullFilling) {
            consumedPieces += quantity;
          } else if (itemFilling === 'Platter') {
            const perType = Math.round(quantity / 3);
            if (fullFilling === 'Veg' || fullFilling === 'Paneer' || fullFilling === 'Cheese Corn') {
              consumedPieces += perType;
            }
          }
        }
      }

      const remainingTotalPieces = Math.max(0, openingTotalPieces - consumedPieces);
      items.push({
        supplyItemId: si.supplyItemId,
        displayName: si.displayName,
        expectedPackets: Math.floor(remainingTotalPieces / piecesPer),
        expectedPieces: remainingTotalPieces % piecesPer,
        expectedTotalPieces: remainingTotalPieces,
      });
    }

    return items;
  }, [supplyVerification, yesterdayClosing, ordersData, menuData]);

  const getExpected = (supplyItemId: number): ExpectedStockItem | undefined => {
    return expectedStock.find((e) => e.supplyItemId === supplyItemId);
  };

  const closingStockMutation = useMutation({
    mutationFn: () => {
      if (!closingStock) return Promise.reject(new Error('No supply items to record'));
      const items = closingStock.items.map((item) => {
        const current = closingItems[item.supplyItemId] ?? { packets: 0, pieces: 0, wastage: 0, hasConflict: false, conflictReason: '' };
        return {
          supplyItemId: item.supplyItemId,
          packetsLeft: current.packets,
          piecesLeft: current.pieces,
          wastagePieces: current.wastage,
          hasConflict: current.hasConflict,
          conflictReason: current.conflictReason || null,
        };
      });
      return submitClosingStock({ orderDate: targetDate, items });
    },
    onSuccess: () => {
      const conflictCount = Object.values(closingItems).filter((c) => c.hasConflict).length;
      const totalPackets = Object.values(closingItems).reduce((s, c) => s + c.packets, 0);
      trackClosingStockSubmit(targetDate, { conflictCount, totalPackets, itemCount: closingStock!.items.length });
      qc.invalidateQueries({ queryKey: ['closingStock', targetDate] });
      setToast({ message: 'Closing stock saved!', type: 'success' });
      vibrate(haptics.success);
      setTimeout(() => {
        navigate(`/day/${targetDate}`);
      }, 500);
    },
    onError: () => {
      setToast({ message: 'Failed to save closing stock', type: 'error' });
      vibrate(haptics.error);
    },
  });

  const updatePackets = (id: number, delta: number) => {
    vibrate(haptics.light);
    setClosingItems((prev) => {
      const current = prev[id] ?? { packets: 0, pieces: 0, wastage: 0, hasConflict: false, conflictReason: '' };
      const next = Math.max(0, current.packets + delta);
      return { ...prev, [id]: { ...current, packets: next } };
    });
  };

  const updatePieces = (id: number, delta: number, maxPieces: number) => {
    vibrate(haptics.light);
    setClosingItems((prev) => {
      const current = prev[id] ?? { packets: 0, pieces: 0, wastage: 0, hasConflict: false, conflictReason: '' };
      const next = Math.max(0, Math.min(maxPieces - 1, current.pieces + delta));
      return { ...prev, [id]: { ...current, pieces: next } };
    });
  };

  const updateWastage = (id: number, delta: number) => {
    vibrate(haptics.light);
    setClosingItems((prev) => {
      const current = prev[id] ?? { packets: 0, pieces: 0, wastage: 0, hasConflict: false, conflictReason: '' };
      const next = Math.max(0, current.wastage + delta);
      return { ...prev, [id]: { ...current, wastage: next } };
    });
  };

  const setPackets = (id: number, val: string) => {
    const num = parseInt(val, 10);
    setClosingItems((prev) => {
      const current = prev[id] ?? { packets: 0, pieces: 0, wastage: 0, hasConflict: false, conflictReason: '' };
      return { ...prev, [id]: { ...current, packets: isNaN(num) ? 0 : num } };
    });
  };

  const setPieces = (id: number, val: string, maxPieces: number) => {
    const num = parseInt(val, 10);
    setClosingItems((prev) => {
      const current = prev[id] ?? { packets: 0, pieces: 0, wastage: 0, hasConflict: false, conflictReason: '' };
      return { ...prev, [id]: { ...current, pieces: isNaN(num) ? 0 : Math.min(num, maxPieces - 1) } };
    });
  };

  const setWastage = (id: number, val: string) => {
    const num = parseInt(val, 10);
    setClosingItems((prev) => {
      const current = prev[id] ?? { packets: 0, pieces: 0, wastage: 0, hasConflict: false, conflictReason: '' };
      return { ...prev, [id]: { ...current, wastage: isNaN(num) ? 0 : Math.max(0, num) } };
    });
  };

  const toggleConflict = (id: number) => {
    setClosingItems((prev) => {
      const current = prev[id] ?? { packets: 0, pieces: 0, wastage: 0, hasConflict: false, conflictReason: '' };
      return { ...prev, [id]: { ...current, hasConflict: !current.hasConflict } };
    });
  };

  const setConflictReason = (id: number, reason: string) => {
    setClosingItems((prev) => {
      const current = prev[id] ?? { packets: 0, pieces: 0, wastage: 0, hasConflict: false, conflictReason: '' };
      return { ...prev, [id]: { ...current, conflictReason: reason } };
    });
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

        {/* Liv Stock Summary */}
        {expectedStock.length > 0 && (
          <Paper sx={{ borderRadius: 2, overflow: 'hidden', border: 1, borderColor: 'divider', mb: 2 }}>
            <Box
              onClick={() => setLiveStockExpanded((v) => !v)}
              sx={{
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                background: isDark ? 'rgba(27,107,58,0.08)' : '#F0FDF4',
                '&:hover': { background: isDark ? 'rgba(27,107,58,0.14)' : '#DCFCE7' },
                transition: 'background 0.15s',
              }}
            >
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: isDark ? '#4ADE80' : '#1B6B3A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Live Stock
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: isDark ? '#9CA3AF' : 'text.secondary', mt: 0.125 }}>
                  Expected remaining · tap to {liveStockExpanded ? 'hide' : 'show'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Package size={14} color={isDark ? '#4ADE80' : '#1B6B3A'} />
                  <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: isDark ? '#4ADE80' : '#1B6B3A' }}>
                    {expectedStock.reduce((s, i) => s + i.expectedPackets, 0)} pkt
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: isDark ? '#9CA3AF' : 'text.secondary' }}>
                    {expectedStock.reduce((s, i) => s + i.expectedTotalPieces, 0)} momos
                  </Typography>
                </Box>
                {liveStockExpanded ? <ChevronUp size={16} color={isDark ? '#4ADE80' : '#1B6B3A'} /> : <ChevronDown size={16} color={isDark ? '#4ADE80' : '#1B6B3A'} />}
              </Box>
            </Box>
            <Collapse in={liveStockExpanded}>
              <Box sx={{ p: 1.5, pt: 1 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
                  {expectedStock.map((item) => {
                    const filling = item.displayName.includes('Cheese Corn') ? 'Cheese Corn' : item.displayName.split(' ')[0];
                    return (
                      <Box key={item.supplyItemId} sx={{ textAlign: 'center', p: 1, borderRadius: 1.5, border: '1px solid', borderColor: 'divider', backgroundColor: isDark ? 'rgba(27,107,58,0.06)' : 'transparent' }}>
                        <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>
                          {filling}
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: isDark ? '#4ADE80' : '#1B6B3A' }}>
                            {item.expectedPackets} pkt
                          </Typography>
                          {item.expectedPieces > 0 && (
                            <Typography sx={{ fontSize: '0.75rem', color: isDark ? '#4ADE80' : '#1B6B3A', fontWeight: 600 }}>
                              + {item.expectedPieces} pcs
                            </Typography>
                          )}
                          <Typography sx={{ fontSize: '0.65rem', color: isDark ? '#9CA3AF' : 'text.secondary', fontWeight: 500, mt: 0.25 }}>
                            {item.expectedTotalPieces} total
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Collapse>
          </Paper>
        )}

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
              const current = closingItems[item.supplyItemId] ?? { packets: 0, pieces: 0, wastage: 0, hasConflict: false, conflictReason: '' };
              const expected = getExpected(item.supplyItemId);
              const hasMismatch = expected && (current.packets !== expected.expectedPackets || current.pieces !== expected.expectedPieces);
              return (
                <Box
                  key={item.supplyItemId}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    py: { xs: 1, md: 1.25 },
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:last-child': { borderBottom: 0 },
                    gap: 1,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: { xs: '0.85rem', md: '0.95rem' }, color: 'text.primary' }}>
                        {item.displayName.replace(/\s*\(\d+\s*Pcs\)/i, '')}
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                        {item.category === 'momo_packet' ? `${item.piecesPer} pcs per packet` : 'per pack'}
                        {expected && ` · Expected: ${expected.expectedPackets} pkt + ${expected.expectedPieces} pcs`}
                      </Typography>
                    </Box>
                    {hasMismatch && !current.hasConflict && (
                      <Chip
                        size="small"
                        label="Mismatch"
                        color="warning"
                        sx={{ height: 20, fontSize: '0.6rem', fontWeight: 700 }}
                      />
                    )}
                    {current.hasConflict && (
                      <Chip
                        size="small"
                        label="Conflict"
                        color="error"
                        sx={{ height: 20, fontSize: '0.6rem', fontWeight: 700 }}
                      />
                    )}
                  </Box>

                  {/* Actual Stock Inputs */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 0.75 }, flexWrap: 'wrap' }}>
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
                    {item.category === 'momo_packet' && (
                      <>
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
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mx: 0.5 }}>+</Typography>
                      </>
                    )}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={() => updateWastage(item.supplyItemId, -1)}
                          sx={{ width: 28, height: 28, border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : theme.palette.divider}`, borderRadius: 1, p: 0 }}
                        >
                          <Minus size={12} />
                        </IconButton>
                        <Box
                          component="input"
                          type="number"
                          value={current.wastage}
                          onChange={(e) => setWastage(item.supplyItemId, e.target.value)}
                          sx={{
                            width: 44,
                            textAlign: 'center',
                            fontSize: '0.85rem',
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
                          onClick={() => updateWastage(item.supplyItemId, 1)}
                          sx={{ width: 28, height: 28, border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : theme.palette.divider}`, borderRadius: 1, p: 0 }}
                        >
                          <Plus size={12} />
                        </IconButton>
                      </Box>
                      <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', mt: 0.25 }}>wastage</Typography>
                    </Box>

                    {/* Conflict Toggle */}
                    <Button
                      size="small"
                      variant={current.hasConflict ? 'contained' : 'outlined'}
                      color={current.hasConflict ? 'error' : 'warning'}
                      onClick={() => toggleConflict(item.supplyItemId)}
                      startIcon={<AlertTriangle size={12} />}
                      sx={{ ml: 'auto', minWidth: 0, px: 1, py: 0.5, fontSize: '0.65rem', fontWeight: 700, textTransform: 'none', height: 28 }}
                    >
                      {current.hasConflict ? 'Conflict' : 'Flag'}
                    </Button>
                  </Box>

                  {/* Conflict Reason */}
                  {current.hasConflict && (
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="Describe the conflict / discrepancy..."
                      value={current.conflictReason}
                      onChange={(e) => setConflictReason(item.supplyItemId, e.target.value)}
                      sx={{ mt: 0.5 }}
                    />
                  )}
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
