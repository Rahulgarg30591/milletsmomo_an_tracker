import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Typography, Paper, useTheme } from '@mui/material';
import { ArrowLeft, Flame } from 'lucide-react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getCylinderMonthReport } from '../api/cylinderApi';
import { formatDateLabel } from '../utils/dateUtils';
import MonthPicker, { monthLabel, useMonthParam } from '../components/MonthPicker';
import { brandInfo, formatRupees } from '../utils/cylinder';
import { trackPageView } from '../utils/tracking';
import SkeletonLoader from '../components/animations/SkeletonLoader';

/** Cylinder refills for a month: when, which brand, and what they cost. */
export default function AdminCylindersPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const [month, setMonth, currentMonth] = useMonthParam();

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ['cylinderMonth', month],
    queryFn: () => getCylinderMonthReport(month),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    trackPageView('admin_cylinders', `Viewed cylinder refills for ${month}`);
  }, [month]);

  const cardBorder = `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : theme.palette.divider}`;

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
            Cylinders
          </Typography>
        </Box>

        <MonthPicker month={month} currentMonth={currentMonth} onChange={setMonth} />

        {isLoading ? (
          <SkeletonLoader count={3} height={72} />
        ) : isError || !report ? (
          <Typography sx={{ color: 'error.main', textAlign: 'center', mt: 4 }}>
            Couldn{'’'}t load cylinder refills.
          </Typography>
        ) : (
          <>
            {/* Totals */}
            <Paper sx={{ p: 2, borderRadius: 2, mb: 1.5, border: cardBorder }}>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 600 }}>
                {monthLabel(month)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: '1.6rem', color: 'text.primary' }} data-testid="cylinder-month-total">
                  {formatRupees(report.totalAmount)}
                </Typography>
                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'text.secondary' }}>
                  {report.count} {report.count === 1 ? 'cylinder' : 'cylinders'}
                </Typography>
              </Box>
            </Paper>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 2 }}>
              {report.byBrand.map((b) => {
                const info = brandInfo(b.brand);
                return (
                  <Paper key={b.brand} sx={{ p: 1.25, borderRadius: 2, border: cardBorder, borderTop: `3px solid ${info.color}` }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: 'text.primary' }}>{info.short}</Typography>
                    <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary', mb: 0.5, lineHeight: 1.2 }}>{info.full}</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'text.primary' }}>{formatRupees(b.totalAmount)}</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>× {b.count}</Typography>
                  </Paper>
                );
              })}
            </Box>

            {/* By source */}
            {report.bySource.length > 0 && (
              <Paper sx={{ borderRadius: 2, overflow: 'hidden', border: cardBorder, mb: 2 }}>
                <Typography sx={{ px: 1.5, pt: 1.25, pb: 0.5, fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  By source
                </Typography>
                {report.bySource.map((s) => (
                  <Box
                    key={s.source ?? ''}
                    data-testid="cylinder-source-row"
                    sx={{ px: 1.5, py: 0.75, display: 'flex', alignItems: 'center', gap: 1, borderTop: 1, borderColor: 'divider' }}
                  >
                    <Typography sx={{ flex: 1, minWidth: 0, fontSize: '0.85rem', fontWeight: 600, color: s.source ? 'text.primary' : 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.source ?? 'Not recorded'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>× {s.count}</Typography>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'text.primary', minWidth: 64, textAlign: 'right' }}>
                      {formatRupees(s.totalAmount)}
                    </Typography>
                  </Box>
                ))}
              </Paper>
            )}

            {/* Refills */}
            {report.refills.length === 0 ? (
              <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 2, border: `2px dashed ${theme.palette.divider}`, background: 'transparent' }}>
                <Flame size={20} color={theme.palette.text.secondary} />
                <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', mt: 0.5 }}>
                  No cylinders refilled in {monthLabel(month)}.
                </Typography>
              </Paper>
            ) : (
              <Paper sx={{ borderRadius: 2, overflow: 'hidden', border: cardBorder }}>
                {report.refills.map((r) => {
                  const info = brandInfo(r.brand);
                  return (
                    <Box
                      key={r.id}
                      data-testid="cylinder-month-row"
                      sx={{ px: 1.5, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.25, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}
                    >
                      <Box sx={{ width: 6, alignSelf: 'stretch', borderRadius: 1, backgroundColor: info.color }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'text.primary' }}>
                          {formatDateLabel(r.refillDate)} · {info.short}
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: r.source ? 'text.primary' : 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.source ? `from ${r.source}` : 'Source not recorded'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                          by {r.createdByName} · {new Date(r.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          {r.updatedAt && ` · edited${r.updatedByName ? ` by ${r.updatedByName}` : ''}`}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: 'text.primary' }}>
                        {formatRupees(r.amount)}
                      </Typography>
                    </Box>
                  );
                })}
              </Paper>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
