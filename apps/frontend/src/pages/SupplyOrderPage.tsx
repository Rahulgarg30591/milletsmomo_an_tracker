import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Button, Typography, Paper, useTheme, IconButton, Accordion, AccordionSummary, AccordionDetails, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import { ArrowLeft, Minus, Plus, Save, Truck, History, ChevronDown, CheckCircle2, AlertCircle, Package, AlertTriangle, Download, ClipboardCopy } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupplyItems, getSupplyOrder, getSupplyOrderLogs, saveSupplyOrder } from '../api/supplyApi';
import { getSupplyVerification } from '../api/supplyVerificationApi';
import { getClosingStock } from '../api/closingStockApi';
import { getStaffLogs } from '../api/staffLogApi';
import { getToday, addDays, formatDateLabel } from '../utils/dateUtils';
import { exportSupplyToExcel } from '../utils/exportSupply';
import Toast from '../components/Toast';
import { vibrate, haptics } from '../theme/tokens';
import type { SupplyItem, SupplyOrderLog, StaffOperationLog } from '../types';

export default function SupplyOrderPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const date = searchParams.get('date') || getToday();

  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [clipboardFallback, setClipboardFallback] = useState<string | null>(null);

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

  const { data: staffLogsData } = useQuery({
    queryKey: ['staffLogs', date, 'verification'],
    queryFn: () => getStaffLogs(date, 'verification'),
  });
  const staffLogs = staffLogsData?.logs || [];

  // Verification status for selected date
  const { data: verification } = useQuery({
    queryKey: ['supplyVerification', date],
    queryFn: () => getSupplyVerification(date),
    enabled: !!date,
  });

  // Yesterday's closing stock
  const yesterday = addDays(date, -1);
  const { data: yesterdayStock } = useQuery({
    queryKey: ['closingStock', yesterday],
    queryFn: () => getClosingStock(yesterday),
    enabled: !!yesterday,
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
        return Object.fromEntries(Object.entries(prev).filter(([k]) => Number(k) !== id));
      }
      return { ...prev, [id]: next };
    });
  };

  const setQty = (id: number, val: string) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 0) return;
    setQuantities((prev) => {
      if (num === 0) {
        return Object.fromEntries(Object.entries(prev).filter(([k]) => Number(k) !== id));
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

  const createOrderText = () => {
    const dateObj = new Date(date + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    const lines: string[] = [`*Date: ${formattedDate}*`];

    let idx = 1;
    const allItems = [
      ...momoPackets.map((i) => ({ ...i, minQty: 0 })),
      ...sauces.map((i) => ({ ...i, minQty: 0 })),
    ];
    allItems.forEach((item) => {
      const qty = quantities[item.id] || 0;
      if (qty > item.minQty) {
        const name = item.displayName.replace(/\s*\(\d+\s*Pcs\)/i, '').replace(/\s*packet\s*/i, '');
        lines.push(`${idx}. ${name}: ${qty}`);
        idx++;
      }
    });

    return lines.join('\n');
  };

  const handleCopyOrderText = async () => {
    const text = createOrderText();
    const copied = await copyToClipboard(text);
    if (copied) {
      vibrate(haptics.success);
      setToast({ message: 'Order text copied to clipboard!', type: 'success' });
    } else {
      setClipboardFallback(text);
    }
  };

  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fall through to legacy fallback
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  };

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
      qc.invalidateQueries({ queryKey: ['supplyOrders'] });
      qc.invalidateQueries({ queryKey: ['supplyLogs', date] });
      qc.invalidateQueries({ queryKey: ['staffLogs', date, 'verification'] });
      navigate('/admin');
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
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'primary.main', mt: 0.25, opacity: qty > 0 ? 1 : 0, minHeight: '1.1rem' }}>
                {qty > 0 ? `₹${lineTotal.toLocaleString()}${item.category === 'momo_packet' ? ` · ${qty * item.piecesPer} pcs` : ''}` : ' '}
              </Typography>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Download size={14} />}
              onClick={() => {
                vibrate(haptics.light);
                exportSupplyToExcel({
                  date,
                  existingOrder,
                  logs,
                  staffLogs,
                  verification,
                  items,
                });
                setToast({ message: 'Excel exported!', type: 'success' });
              }}
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2, fontSize: '0.75rem', py: 0.5, px: 1.5 }}
            >
              Export
            </Button>
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

        {/* Verification Status */}
        <Paper sx={{
          borderRadius: 2,
          p: 1.5,
          mb: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: (() => {
            if (!verification?.items || verification.items.length === 0) return isDark ? 'rgba(156,163,175,0.08)' : '#F9FAFB';
            if (verification.isFullyVerified) return isDark ? 'rgba(45,138,78,0.08)' : '#F0FDF4';
            return isDark ? 'rgba(220,38,38,0.08)' : '#FEF2F2';
          })(),
          border: `1px solid ${(() => {
            if (!verification?.items || verification.items.length === 0) return isDark ? 'rgba(156,163,175,0.2)' : 'rgba(156,163,175,0.2)';
            if (verification.isFullyVerified) return isDark ? 'rgba(45,138,78,0.2)' : 'rgba(45,138,78,0.15)';
            return isDark ? 'rgba(220,38,38,0.2)' : 'rgba(220,38,38,0.15)';
          })()}`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {(() => {
              if (!verification?.items || verification.items.length === 0) return <Package size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />;
              if (verification.isFullyVerified) return <CheckCircle2 size={18} color={isDark ? '#4ADE80' : '#16A34A'} />;
              return <AlertCircle size={18} color={isDark ? '#F87171' : '#DC2626'} />;
            })()}
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.primary' }}>
                {(() => {
                  if (!verification?.items || verification.items.length === 0) return 'No Supply Created';
                  if (verification.isFullyVerified) return 'Supply Verified';
                  return 'Not Verified';
                })()}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                {(() => {
                  if (!verification?.items || verification.items.length === 0) return 'No supply order found for this date';
                  if (verification.isFullyVerified) return (verification.conflictCount && verification.conflictCount > 0 ? `${verification.conflictCount} conflict(s) reported` : 'All items match');
                  return 'Staff has not verified today\'s supply yet';
                })()}
              </Typography>
            </Box>
          </Box>
          <Typography sx={{
            fontWeight: 700,
            fontSize: '0.75rem',
            px: 0.75,
            py: 0.25,
            borderRadius: 1,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            backgroundColor: (() => {
              if (!verification?.items || verification.items.length === 0) return isDark ? 'rgba(156,163,175,0.15)' : '#F3F4F6';
              if (verification.isFullyVerified) return isDark ? 'rgba(74,222,128,0.15)' : '#D1FAE5';
              return isDark ? 'rgba(248,113,113,0.15)' : '#FEE2E2';
            })(),
            color: (() => {
              if (!verification?.items || verification.items.length === 0) return isDark ? '#9CA3AF' : '#6B7280';
              if (verification.isFullyVerified) return isDark ? '#4ADE80' : '#16A34A';
              return isDark ? '#F87171' : '#DC2626';
            })(),
          }}>
            {(() => {
              if (!verification?.items || verification.items.length === 0) return 'No Supply';
              if (verification.isFullyVerified) return 'Verified';
              return 'Pending';
            })()}
          </Typography>
        </Paper>

        {/* Yesterday's Left Over Stock Accordion */}
        {yesterdayStock && yesterdayStock.items.length > 0 && (
          <Accordion
            defaultExpanded={false}
            sx={{
              borderRadius: 2,
              mb: 2,
              overflow: 'hidden',
              background: isDark ? 'linear-gradient(135deg, #1E1E26 0%, #252530 100%)' : undefined,
              border: isDark ? '1px solid rgba(255,255,255,0.06)' : undefined,
              '&:before': { display: 'none' },
              boxShadow: 'none',
            }}
          >
            <AccordionSummary
              expandIcon={<ChevronDown size={16} />}
              sx={{
                px: 1.5,
                py: 0.5,
                '& .MuiAccordionSummary-content': {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  my: 0.75,
                },
              }}
            >
              <Package size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Yesterday's Left Over: {formatDateLabel(yesterday)}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 1.5, pt: 0, pb: 1.5 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 1 }}>
                {yesterdayStock.items.map((item) => (
                  <Box
                    key={item.supplyItemId}
                    sx={{
                      p: 1,
                      borderRadius: 1,
                      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'text.primary', mb: 0.25 }}>
                      {item.displayName.replace(/\s*\(\d+\s*Pcs\)/i, '')}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      {item.packetsLeft > 0 && `${item.packetsLeft} pkt`}
                      {item.packetsLeft > 0 && item.piecesLeft > 0 && ' + '}
                      {item.piecesLeft > 0 && `${item.piecesLeft} pcs`}
                      {item.packetsLeft === 0 && item.piecesLeft === 0 && 'None'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', fontWeight: 500, mt: 0.25 }}>
                      {item.totalPiecesLeft} pieces total
                    </Typography>
                  </Box>
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

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

        <Button
          fullWidth
          variant="outlined"
          size="large"
          disabled={!hasItems}
          onClick={handleCopyOrderText}
          startIcon={<ClipboardCopy size={18} />}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: 2,
            py: 1.5,
            fontSize: '0.95rem',
            mt: 1.5,
          }}
        >
          Create Order Text
        </Button>

        {/* Supply Change Logs */}
        {(logs.length > 0 || staffLogs.length > 0) && (
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
              {([...logs.map((l: SupplyOrderLog) => ({ type: 'supply' as const, ...l })), ...staffLogs.map((l: StaffOperationLog) => ({ type: 'staff' as const, ...l }))])
                .sort((a: { createdAt: string }, b: { createdAt: string }) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((log: { type: 'supply' | 'staff'; id: number; createdAt: string; displayName: string; action?: 'CREATE' | 'UPDATE'; itemSummary?: string; details?: string }) => {
                  const logTime = new Date(log.createdAt);
                  const timeStr = logTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                  const dateStr = logTime.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                  const isSupply = log.type === 'supply';
                  return (
                    <Box
                      key={`${log.type}-${log.id}`}
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
                            backgroundColor: isSupply
                              ? (log.action === 'CREATE' ? (isDark ? 'rgba(74,222,128,0.15)' : '#D1FAE5') : (isDark ? 'rgba(96,165,250,0.15)' : '#DBEAFE'))
                              : (isDark ? 'rgba(250,204,21,0.15)' : '#FEF9C3'),
                            color: isSupply
                              ? (log.action === 'CREATE' ? (isDark ? '#4ADE80' : '#065F46') : (isDark ? '#60A5FA' : '#1E40AF'))
                              : (isDark ? '#FACC15' : '#854D0E'),
                          }}>
                            {isSupply ? log.action : 'VERIFIED'}
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
                      {isSupply ? log.itemSummary : log.details}
                    </Typography>
                    {!isSupply && 'operationType' in log && log.operationType === 'verification' && verification?.items && verification.items.length > 0 && (
                      <Box sx={{ mt: 0.5, pl: 0.5 }}>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', mb: 0.25, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <AlertTriangle size={10} />
                          Verification Details
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                          {verification.items.map((item) => (
                            <Box key={item.supplyItemId} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: item.hasConflict ? '#DC2626' : '#16A34A' }} />
                              <Typography sx={{ fontSize: '0.7rem', color: item.hasConflict ? 'error.main' : 'text.secondary', lineHeight: 1.3 }}>
                                {item.displayName.replace(/\s*\(\d+\s*Pcs\)/i, '')}: expected {item.expectedQty}, found {item.actualQty ?? 0} {item.hasConflict && '(CONFLICT)'}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    )}
                    </Box>
                  );
                })}
            </Box>
          </Paper>
        )}
      </Box>

      {clipboardFallback && (
        <Dialog open onClose={() => setClipboardFallback(null)} fullWidth maxWidth="sm">
          <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>Copy Order Text</DialogTitle>
          <DialogContent>
            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1.5 }}>
              Clipboard copy failed. Select the text below and copy manually.
            </Typography>
            <TextField
              multiline
              fullWidth
              rows={6}
              value={clipboardFallback}
              variant="outlined"
              inputProps={{ readOnly: true, sx: { fontSize: '0.85rem', fontFamily: 'monospace' } }}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={async () => {
                const ok = await copyToClipboard(clipboardFallback);
                if (ok) {
                  vibrate(haptics.success);
                  setToast({ message: 'Order text copied to clipboard!', type: 'success' });
                  setClipboardFallback(null);
                } else {
                  setToast({ message: 'Copy failed — select text manually', type: 'error' });
                }
              }}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Retry Copy
            </Button>
            <Button onClick={() => setClipboardFallback(null)} sx={{ textTransform: 'none', fontWeight: 700 }}>
              Close
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Box>
  );
}