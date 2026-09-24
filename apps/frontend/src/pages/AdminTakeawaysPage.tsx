import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Typography, Paper, IconButton, TextField, MenuItem, ListSubheader, useTheme,
  Dialog, DialogTitle, DialogContent, DialogActions, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { ArrowLeft, UserRound, Plus, Minus, Pencil, Trash2, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { buildMenu, PREPARATIONS } from 'shared';
import { getTakeawayMonth, addTakeaway, updateTakeaway, deleteTakeaway } from '../api/staffApi';
import { formatDateLabel, getToday } from '../utils/dateUtils';
import { formatQuantity } from '../utils/formatQuantity';
import { calculateLineTotal } from '../utils/pricing';
import { formatRupees } from '../utils/cylinder';
import { trackPageView } from '../utils/tracking';
import MonthPicker, { monthLabel, useMonthParam } from '../components/MonthPicker';
import StaffNameField from '../components/StaffNameField';
import SkeletonLoader from '../components/animations/SkeletonLoader';
import Toast from '../components/Toast';
import { vibrate, haptics } from '../theme/tokens';
import type { StaffTakeaway } from '../types';

/**
 * Staff pay this share off the menu. The server applies and stores the
 * discount; this copy only previews the amount while the form is filled in.
 */
const STAFF_DISCOUNT_PCT = 25;

const MOMOS = buildMenu().filter((m) => !m.isBeverage);

interface DraftLine {
  key: number;
  menuItemId: number;
  half: boolean;
  plates: number;
}

function toPayloadItem(l: DraftLine) {
  return { menuItemId: l.menuItemId, quantity: l.plates * (l.half ? 3 : 6), isHalf: l.half };
}

function menuPriceOf(l: DraftLine): number {
  const { menuItemId, quantity, isHalf } = toPayloadItem(l);
  return calculateLineTotal(menuItemId, quantity, isHalf, false).lineTotal;
}

function owedOf(menuPrice: number): number {
  return Math.round(menuPrice * (100 - STAFF_DISCOUNT_PCT)) / 100;
}

function errorDetail(error: unknown): string | undefined {
  return isAxiosError(error) && typeof error.response?.data?.error === 'string'
    ? error.response.data.error
    : undefined;
}

let lineKey = 0;
const newLine = (): DraftLine => ({ key: lineKey++, menuItemId: MOMOS[0].id, half: false, plates: 1 });

/** Turns saved items back into form lines: pieces become plates. */
function toDraftLines(t: StaffTakeaway): DraftLine[] {
  return t.items.map((i) => ({
    key: lineKey++,
    menuItemId: i.menuItemId,
    half: i.isHalf,
    plates: Math.max(1, Math.round(i.quantity / (i.isHalf ? 3 : 6))),
  }));
}

/**
 * Admin records momos a staff member took. Each takeaway is priced at the
 * staff discount and kept as what that person owes; it never reaches the
 * day's revenue, but the momos still count against stock.
 */
export default function AdminTakeawaysPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [month, setMonth, currentMonth] = useMonthParam();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StaffTakeaway | null>(null);
  const [staffName, setStaffName] = useState('');
  const [takeawayDate, setTakeawayDate] = useState(getToday());
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([newLine()]);
  const [nameError, setNameError] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<StaffTakeaway | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ['staffTakeaways', month],
    queryFn: () => getTakeawayMonth(month),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    trackPageView('admin_takeaways', `Viewed staff takeaways for ${month}`);
  }, [month]);

  const preview = useMemo(() => {
    const menuValue = lines.reduce((s, l) => s + menuPriceOf(l), 0);
    return { menuValue, owed: owedOf(menuValue) };
  }, [lines]);

  const openAdd = () => {
    vibrate(haptics.light);
    setEditing(null);
    setStaffName('');
    setTakeawayDate(getToday());
    setNote('');
    setLines([newLine()]);
    setNameError(false);
    setDialogOpen(true);
  };

  const openEdit = (t: StaffTakeaway) => {
    vibrate(haptics.light);
    setEditing(t);
    setStaffName(t.staffName);
    setTakeawayDate(t.takeawayDate);
    setNote(t.note ?? '');
    setLines(toDraftLines(t));
    setNameError(false);
    setDialogOpen(true);
  };

  const updateLine = (key: number, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['staffTakeaways'] });
    qc.invalidateQueries({ queryKey: ['staffNames'] });
    qc.invalidateQueries({ queryKey: ['takeawayItems'] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const input = {
        staffName: staffName.trim(),
        takeawayDate,
        note: note.trim() || null,
        items: lines.map(toPayloadItem),
      };
      return editing ? updateTakeaway(editing.id, input) : addTakeaway(input);
    },
    onSuccess: (t) => {
      vibrate(haptics.success);
      setToast({
        message: `${t.staffName}: ${formatRupees(t.amountOwed)} owed${editing ? ' (updated)' : ''}`,
        type: 'success',
      });
      setDialogOpen(false);
      invalidate();
      if (t.takeawayDate.slice(0, 7) !== month) setMonth(t.takeawayDate.slice(0, 7));
    },
    onError: (error) => {
      vibrate(haptics.error);
      setToast({ message: errorDetail(error) ?? 'Failed to save takeaway', type: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTakeaway(id),
    onSuccess: () => {
      vibrate(haptics.success);
      setToast({ message: 'Takeaway removed', type: 'success' });
      setPendingDelete(null);
      invalidate();
    },
    onError: () => {
      vibrate(haptics.error);
      setToast({ message: 'Failed to remove takeaway', type: 'error' });
    },
  });

  const submit = () => {
    if (!staffName.trim()) {
      setNameError(true);
      return;
    }
    saveMutation.mutate();
  };

  const cardBorder = `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : theme.palette.divider}`;
  const accent = isDark ? '#FCD34D' : '#B45309';

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
            Staff Takeaways
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<Plus size={16} />}
            onClick={openAdd}
            aria-label="Log Takeaway"
            sx={{ ml: 'auto', textTransform: 'none', fontWeight: 700, borderRadius: 2, whiteSpace: 'nowrap' }}
          >
            Log
          </Button>
        </Box>

        <MonthPicker month={month} currentMonth={currentMonth} onChange={setMonth} />

        {isLoading ? (
          <SkeletonLoader count={3} height={72} />
        ) : isError || !report ? (
          <Typography sx={{ color: 'error.main', textAlign: 'center', mt: 4 }}>
            Couldn{'’'}t load staff takeaways.
          </Typography>
        ) : (
          <>
            <Paper sx={{ p: 2, borderRadius: 2, mb: 2, border: cardBorder }}>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 600 }}>
                {monthLabel(month)} · owed by staff at {report.discountPct}% off
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: '1.6rem', color: 'text.primary' }} data-testid="takeaway-month-owed">
                  {formatRupees(report.amountOwed)}
                </Typography>
                <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: 'text.secondary', textAlign: 'right' }}>
                  {formatQuantity(report.pieces)} · {report.count} {report.count === 1 ? 'time' : 'times'}
                  <br />
                  menu {formatRupees(report.menuValue)}
                </Typography>
              </Box>
              {report.byStaff.length > 0 && (
                <Box sx={{ mt: 1, borderTop: 1, borderColor: 'divider' }}>
                  {report.byStaff.map((s) => (
                    <Box
                      key={s.staffName}
                      data-testid="takeaway-staff-row"
                      sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}
                    >
                      <Typography sx={{ flex: 1, fontWeight: 600, fontSize: '0.9rem', color: 'text.primary' }}>{s.staffName}</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                        {formatQuantity(s.pieces)} · {s.count}×
                      </Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: accent, minWidth: 72, textAlign: 'right' }}>
                        {formatRupees(s.amountOwed)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>

            {report.takeaways.length === 0 ? (
              <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 2, border: `2px dashed ${theme.palette.divider}`, background: 'transparent' }}>
                <UserRound size={20} color={theme.palette.text.secondary} />
                <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', mt: 0.5 }}>
                  No staff takeaways in {monthLabel(month)}.
                </Typography>
              </Paper>
            ) : (
              <Paper sx={{ borderRadius: 2, overflow: 'hidden', border: cardBorder }}>
                {report.takeaways.map((t) => (
                  <Box
                    key={t.id}
                    data-testid="takeaway-row"
                    sx={{ px: 1.5, py: 1.25, display: 'flex', alignItems: 'center', gap: 1, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}
                  >
                    <Box sx={{ width: 6, alignSelf: 'stretch', borderRadius: 1, backgroundColor: accent }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'text.primary' }}>
                        {formatDateLabel(t.takeawayDate)} · {t.staffName}
                      </Typography>
                      {t.items.map((i, idx) => (
                        <Typography key={idx} sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          {formatQuantity(i.quantity)} {i.itemName}{i.isHalf ? ' (½)' : ''}
                        </Typography>
                      ))}
                      {t.note && (
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.primary', fontStyle: 'italic' }}>“{t.note}”</Typography>
                      )}
                      <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                        by {t.createdByName}{t.updatedAt && ` · edited${t.updatedByName ? ` by ${t.updatedByName}` : ''}`}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: 'text.primary' }}>
                        {formatRupees(t.amountOwed)}
                      </Typography>
                      <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'line-through' }}>
                        {formatRupees(t.menuValue)}
                      </Typography>
                    </Box>
                    <IconButton size="small" aria-label={`Edit takeaway for ${t.staffName}`} onClick={() => openEdit(t)} sx={{ color: 'text.secondary' }}>
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton size="small" aria-label={`Remove takeaway for ${t.staffName}`} onClick={() => setPendingDelete(t)} sx={{ color: 'error.main' }}>
                      <Trash2 size={18} />
                    </IconButton>
                  </Box>
                ))}
              </Paper>
            )}
          </>
        )}
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>
          {editing ? 'Edit staff takeaway' : 'Log staff takeaway'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '8px !important' }}>
          <StaffNameField
            value={staffName}
            onChange={(v) => {
              setStaffName(v);
              if (v.trim()) setNameError(false);
            }}
            error={nameError}
          />
          <TextField
            label="Date"
            type="date"
            value={takeawayDate}
            onChange={(e) => e.target.value && setTakeawayDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />

          {lines.map((l, idx) => (
            <Paper key={l.key} data-testid="takeaway-line" sx={{ p: 1, borderRadius: 1.5, border: cardBorder, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  select
                  size="small"
                  label={`Item ${idx + 1}`}
                  value={l.menuItemId}
                  onChange={(e) => updateLine(l.key, { menuItemId: Number(e.target.value) })}
                  sx={{ flex: 1 }}
                >
                  {PREPARATIONS.flatMap((prep) => [
                    <ListSubheader key={`h-${prep}`}>{prep}</ListSubheader>,
                    ...MOMOS.filter((m) => m.preparation === prep).map((m) => (
                      <MenuItem key={m.id} value={m.id}>{m.displayName}</MenuItem>
                    )),
                  ])}
                </TextField>
                {lines.length > 1 && (
                  <IconButton size="small" aria-label={`Remove item ${idx + 1}`} onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}>
                    <X size={16} />
                  </IconButton>
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={l.half ? 'half' : 'full'}
                  onChange={(_, v) => v && updateLine(l.key, { half: v === 'half' })}
                  aria-label={`Plate size for item ${idx + 1}`}
                >
                  <ToggleButton value="full" sx={{ textTransform: 'none', px: 1.25 }}>Full</ToggleButton>
                  <ToggleButton value="half" sx={{ textTransform: 'none', px: 1.25 }}>Half</ToggleButton>
                </ToggleButtonGroup>
                <IconButton size="small" aria-label={`Fewer plates of item ${idx + 1}`} disabled={l.plates <= 1} onClick={() => updateLine(l.key, { plates: l.plates - 1 })}>
                  <Minus size={16} />
                </IconButton>
                <Typography sx={{ minWidth: 20, textAlign: 'center', fontWeight: 700 }} aria-label={`Plates of item ${idx + 1}`}>{l.plates}</Typography>
                <IconButton size="small" aria-label={`More plates of item ${idx + 1}`} disabled={l.plates >= 10} onClick={() => updateLine(l.key, { plates: l.plates + 1 })}>
                  <Plus size={16} />
                </IconButton>
                <Typography sx={{ ml: 'auto', fontWeight: 700, fontSize: '0.85rem' }}>
                  {formatRupees(owedOf(menuPriceOf(l)))}
                </Typography>
              </Box>
            </Paper>
          ))}
          <Button
            size="small"
            startIcon={<Plus size={14} />}
            onClick={() => setLines((prev) => [...prev, newLine()])}
            disabled={lines.length >= 20}
            sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}
          >
            Add item
          </Button>

          <TextField
            label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            inputProps={{ maxLength: 200 }}
          />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: 1, borderColor: 'divider', pt: 1 }}>
            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
              Menu {formatRupees(preview.menuValue)} − {STAFF_DISCOUNT_PCT}%
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }} data-testid="takeaway-preview-owed">
              Owes {formatRupees(preview.owed)}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={saveMutation.isPending}
            onClick={submit}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {saveMutation.isPending ? 'Saving...' : editing ? 'Update Takeaway' : 'Save Takeaway'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!pendingDelete} onClose={() => setPendingDelete(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>Remove this takeaway?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
            {pendingDelete && `${pendingDelete.staffName}, ${formatDateLabel(pendingDelete.takeawayDate)}, ${formatRupees(pendingDelete.amountOwed)} owed. `}
            The removal is recorded in the staff log.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Keep
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {deleteMutation.isPending ? 'Removing...' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Box>
  );
}
