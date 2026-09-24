import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Button, Typography, Paper, IconButton, TextField, useTheme } from '@mui/material';
import { ArrowLeft, ChevronLeft, ChevronRight, Package, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getClosingStock } from '../api/closingStockApi';
import { getSupplyVerification } from '../api/supplyVerificationApi';
import { getAdminOrders } from '../api/adminApi';
import { useMenu } from '../hooks/useMenu';
import { useTakeawayItems } from '../hooks/useTakeawayItems';
import { reconcileClosingStock, type ReconciledItem } from '../utils/stockReconciliation';
import { addDays, formatDateLabel, getToday } from '../utils/dateUtils';
import { trackPageView } from '../utils/tracking';
import SkeletonLoader from '../components/animations/SkeletonLoader';

function packs(packets: number, pieces: number): string {
  if (packets && pieces) return `${packets} pkt + ${pieces} pcs`;
  if (packets) return `${packets} pkt`;
  return `${pieces} pcs`;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

/**
 * The day's closing count as admin sees it: what staff counted, what should
 * have been left (yesterday's count + supply − sold − taken by staff), and
 * what is unaccounted for once wastage is allowed for, and any flag staff
 * raised. Read-only; staff record it.
 */
export default function AdminClosingStockPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = getToday();
  const raw = searchParams.get('date') || '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;
  const yesterday = addDays(date, -1);
  const setDate = (d: string) => setSearchParams({ date: d });

  const { data: closing, isLoading, isError } = useQuery({
    queryKey: ['closingStock', date],
    queryFn: () => getClosingStock(date),
  });
  const { data: yesterdayClosing } = useQuery({
    queryKey: ['closingStock', yesterday],
    queryFn: () => getClosingStock(yesterday),
  });
  const { data: verification } = useQuery({
    queryKey: ['supplyVerification', date],
    queryFn: () => getSupplyVerification(date),
  });
  const { data: ordersData } = useQuery({
    queryKey: ['adminOrders', date, date],
    queryFn: () => getAdminOrders(date, date),
  });
  const takeawayItems = useTakeawayItems(date);
  const { data: menuData } = useMenu();

  useEffect(() => {
    trackPageView('admin_closing_stock', `Viewed closing stock for ${date}`);
  }, [date]);

  const rows = useMemo<ReconciledItem[]>(
    () => reconcileClosingStock({
      closing,
      yesterday: yesterdayClosing,
      verification,
      // Sales and staff takeaways both left stock.
      orders: [...(ordersData?.orders || []), { items: takeawayItems }],
      menu: menuData?.items || [],
    }),
    [closing, yesterdayClosing, verification, ordersData, takeawayItems, menuData],
  );

  const momos = rows.filter((r) => r.category === 'momo_packet');
  const others = rows.filter((r) => r.category !== 'momo_packet');
  const recorded = !!closing?.isSubmitted;
  const mismatches = momos.filter((r) => r.difference !== 0 || r.hasConflict).length;
  const totals = momos.reduce(
    (t, r) => ({ left: t.left + r.actualTotalPieces, expected: t.expected + r.expectedTotalPieces, wastage: t.wastage + r.wastagePieces }),
    { left: 0, expected: 0, wastage: 0 },
  );

  const cardBorder = `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : theme.palette.divider}`;
  const ok = isDark ? '#4ADE80' : '#16A34A';
  const bad = isDark ? '#F87171' : '#DC2626';
  const warn = isDark ? '#FBBF24' : '#D97706';

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', p: 1.5, pb: 8, pt: 1 }}>
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Button
            size="small"
            startIcon={<ArrowLeft size={16} />}
            onClick={() => navigate('/admin')}
            sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary', minWidth: 0, px: 1 }}
          >
            Back
          </Button>
          <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', color: 'text.primary', letterSpacing: '-0.3px' }}>
            Closing Stock
          </Typography>
        </Box>

        {/* Day picker */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <IconButton aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>
            <ChevronLeft size={20} />
          </IconButton>
          <TextField
            type="date"
            size="small"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            inputProps={{ 'aria-label': 'Date', max: today }}
            sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <IconButton aria-label="Next day" disabled={date >= today} onClick={() => setDate(addDays(date, 1))}>
            <ChevronRight size={20} />
          </IconButton>
        </Box>

        {isLoading ? (
          <SkeletonLoader count={3} height={72} />
        ) : isError ? (
          <Typography sx={{ color: 'error.main', textAlign: 'center', mt: 4 }}>
            Couldn{'’'}t load closing stock.
          </Typography>
        ) : (
          <>
            {/* Status */}
            <Paper sx={{ p: 2, borderRadius: 2, mb: 2, border: cardBorder }} data-testid="closing-status">
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 600 }}>
                {formatDateLabel(date)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                {recorded
                  ? (mismatches > 0 ? <AlertTriangle size={18} color={bad} /> : <CheckCircle2 size={18} color={ok} />)
                  : <Clock size={18} color={warn} />}
                <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: 'text.primary' }}>
                  {!recorded
                    ? 'Not recorded yet'
                    : mismatches > 0
                      ? `${mismatches} item${mismatches === 1 ? '' : 's'} off`
                      : 'All counts match'}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.25 }}>
                {recorded
                  ? `Recorded by ${closing?.recordedByName ?? 'staff'}${closing?.recordedAt ? ` · ${new Date(closing.recordedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : ''}`
                  : 'Staff record this from the day view. Expected figures below are what should be left now.'}
              </Typography>
              {momos.length > 0 && (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mt: 1.5, pt: 1.25, borderTop: 1, borderColor: 'divider' }}>
                  {[
                    { label: 'Counted', value: recorded ? `${totals.left}` : '—' },
                    { label: 'Expected', value: `${totals.expected}` },
                    { label: 'Wastage', value: recorded ? `${totals.wastage}` : '—' },
                  ].map((t) => (
                    <Box key={t.label}>
                      <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{t.label}</Typography>
                      <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: 'text.primary' }}>{t.value}</Typography>
                      <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>momos</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>

            {rows.length === 0 ? (
              <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 2, border: `2px dashed ${theme.palette.divider}`, background: 'transparent' }}>
                <Package size={20} color={theme.palette.text.secondary} />
                <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', mt: 0.5 }}>
                  No stock items for this day.
                </Typography>
              </Paper>
            ) : (
              <>
                <Paper sx={{ borderRadius: 2, overflow: 'hidden', border: cardBorder, mb: 2 }}>
                  {momos.map((r) => {
                    const off = recorded && r.difference !== 0;
                    const tone = !recorded ? 'text.secondary' : off ? bad : ok;
                    return (
                      <Box
                        key={r.supplyItemId}
                        data-testid="closing-row"
                        sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'text.primary' }}>
                            {r.displayName.replace(/\s*\(\d+\s*Pcs\)/i, '')}
                          </Typography>
                          {recorded && (
                            <Typography sx={{ fontWeight: 800, fontSize: '0.8rem', color: tone }} data-testid="closing-diff">
                              {off ? `${signed(r.difference)} pcs` : '✓ match'}
                            </Typography>
                          )}
                        </Box>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mt: 0.5 }}>
                          <Box>
                            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', textTransform: 'uppercase', fontWeight: 700 }}>Counted</Typography>
                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary' }}>
                              {recorded ? packs(r.actualPackets, r.actualPieces) : '—'}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', textTransform: 'uppercase', fontWeight: 700 }}>Expected</Typography>
                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary' }}>
                              {packs(r.expectedPackets, r.expectedPieces)}
                            </Typography>
                          </Box>
                        </Box>
                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', mt: 0.5 }}>
                          Opening {r.openingTotalPieces} · gone {r.consumedPieces}
                          {recorded && r.wastagePieces > 0 && ` · wastage ${r.wastagePieces}`}
                        </Typography>
                        {r.hasConflict && (
                          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start', mt: 0.5, color: warn }}>
                            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                            <Typography sx={{ fontSize: '0.75rem', color: 'inherit' }}>
                              Flagged by staff{r.conflictReason ? `: ${r.conflictReason}` : ''}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Paper>

                {recorded && others.length > 0 && (
                  <Paper sx={{ borderRadius: 2, overflow: 'hidden', border: cardBorder }}>
                    <Typography sx={{ px: 1.5, pt: 1.25, pb: 0.5, fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Sauces &amp; dips
                    </Typography>
                    {others.map((r) => (
                      <Box key={r.supplyItemId} sx={{ px: 1.5, py: 0.75, display: 'flex', justifyContent: 'space-between', borderTop: 1, borderColor: 'divider' }}>
                        <Typography sx={{ fontSize: '0.85rem', color: 'text.primary' }}>{r.displayName}</Typography>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary' }}>{r.actualPackets} left</Typography>
                      </Box>
                    ))}
                  </Paper>
                )}
              </>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
