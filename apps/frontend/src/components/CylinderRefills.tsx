import { useState, useEffect } from 'react';
import {
  Box, Button, Typography, Paper, IconButton, useTheme,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Autocomplete,
} from '@mui/material';
import { Flame, Trash2, Pencil } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { errorDetail } from '../utils/errors';
import { getCylinderRefills, getCylinderSources, addCylinderRefill, updateCylinderRefill, deleteCylinderRefill } from '../api/cylinderApi';
import { CYLINDER_BRANDS, brandInfo, getLastPrice, setLastPrice, formatRupees } from '../utils/cylinder';
import { vibrate, haptics } from '../theme/tokens';
import type { CylinderBrand, CylinderRefill } from '../types';

type ToastFn = (toast: { message: string; type: 'success' | 'error' }) => void;

/** The day's cylinder refills, shared by the staff and admin expense pages. */
export function useCylinderRefills(date: string) {
  return useQuery({
    queryKey: ['cylinders', date],
    queryFn: () => getCylinderRefills(date),
    enabled: !!date,
  });
}


interface CylinderRefillsProps {
  date: string;
  refills: CylinderRefill[];
  addOpen: boolean;
  onAddClose: () => void;
  onToast: ToastFn;
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/**
 * Lists the day's refills and owns the add, edit and delete dialogs.
 *
 * Refills save on their own, straight away, rather than with the page's Save
 * button: each one is a separate record admin reviews by month.
 */
export default function CylinderRefills({ date, refills, addOpen, onAddClose, onToast }: CylinderRefillsProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const qc = useQueryClient();

  const [brand, setBrand] = useState<CylinderBrand | null>(null);
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [editing, setEditing] = useState<CylinderRefill | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CylinderRefill | null>(null);

  const dialogOpen = addOpen || !!editing;

  const { data: sources = [] } = useQuery({
    queryKey: ['cylinderSources'],
    queryFn: getCylinderSources,
    enabled: dialogOpen,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (addOpen) {
      setBrand(null);
      setAmount('');
      setSource('');
    }
  }, [addOpen]);

  const startEdit = (r: CylinderRefill) => {
    vibrate(haptics.light);
    setBrand(r.brand);
    setAmount(String(r.amount));
    setSource(r.source ?? '');
    setEditing(r);
  };

  const closeDialog = () => {
    setEditing(null);
    onAddClose();
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cylinders', date] });
    qc.invalidateQueries({ queryKey: ['cylinderMonth'] });
    qc.invalidateQueries({ queryKey: ['cylinderSources'] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const input = { brand: brand!, amount: parseFloat(amount), source: source.trim() || null };
      return editing
        ? updateCylinderRefill(editing.id, input)
        : addCylinderRefill({ refillDate: date, ...input });
    },
    onSuccess: (refill) => {
      vibrate(haptics.success);
      setLastPrice(refill.brand, refill.amount);
      onToast({
        message: `${brandInfo(refill.brand).short} cylinder ${editing ? 'updated' : 'saved'}`,
        type: 'success',
      });
      invalidate();
      closeDialog();
    },
    onError: (error) => {
      vibrate(haptics.error);
      const detail = errorDetail(error);
      onToast({ message: detail ? `Failed to save cylinder: ${detail}` : 'Failed to save cylinder', type: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCylinderRefill(id),
    onSuccess: () => {
      vibrate(haptics.success);
      onToast({ message: 'Cylinder entry removed', type: 'success' });
      invalidate();
      setPendingDelete(null);
    },
    onError: () => {
      vibrate(haptics.error);
      onToast({ message: 'Failed to remove cylinder entry', type: 'error' });
    },
  });

  const pickBrand = (b: CylinderBrand) => {
    vibrate(haptics.light);
    setBrand(b);
    if (!amount && !editing) setAmount(getLastPrice(b));
  };

  const price = parseFloat(amount);
  const canSave = !!brand && price > 0 && !saveMutation.isPending;

  return (
    <>
      {refills.length > 0 && (
        <Paper
          sx={{
            borderRadius: 2,
            mb: 2,
            overflow: 'hidden',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : theme.palette.divider}`,
          }}
        >
          <Box sx={{ px: 1.5, py: 1, display: 'flex', alignItems: 'center', gap: 0.75, borderBottom: 1, borderColor: 'divider' }}>
            <Flame size={16} color={isDark ? '#FB923C' : '#EA580C'} />
            <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Cylinder refills
            </Typography>
          </Box>
          {refills.map((r) => {
            const info = brandInfo(r.brand);
            return (
              <Box
                key={r.id}
                data-testid="cylinder-refill"
                sx={{
                  px: 1.5, py: 1, display: 'flex', alignItems: 'center', gap: 1,
                  borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 },
                }}
              >
                <Box sx={{ width: 6, alignSelf: 'stretch', borderRadius: 1, backgroundColor: info.color }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'text.primary' }}>
                    {info.short} <Box component="span" sx={{ fontWeight: 500, color: 'text.secondary', fontSize: '0.75rem' }}>{info.full}</Box>
                  </Typography>
                  {r.source && (
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      from {r.source}
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                    by {r.createdByName} · {timeOf(r.createdAt)}
                    {r.updatedAt && ` · edited${r.updatedByName ? ` by ${r.updatedByName}` : ''}`}
                  </Typography>
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: 'text.primary' }}>
                  {formatRupees(r.amount)}
                </Typography>
                <IconButton
                  size="small"
                  aria-label={`Edit ${info.short} cylinder`}
                  onClick={() => startEdit(r)}
                  sx={{ color: 'text.secondary', ml: -0.5 }}
                >
                  <Pencil size={16} />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={`Remove ${info.short} cylinder`}
                  onClick={() => setPendingDelete(r)}
                  sx={{ color: 'error.main' }}
                >
                  <Trash2 size={18} />
                </IconButton>
              </Box>
            );
          })}
        </Paper>
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Flame size={18} color={isDark ? '#FB923C' : '#EA580C'} />
          {editing ? 'Edit cylinder refill' : 'Cylinder refill'}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1 }}>Which cylinder?</Typography>
          <Box role="radiogroup" aria-label="Cylinder brand" sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 2 }}>
            {CYLINDER_BRANDS.map((b) => {
              const selected = brand === b.brand;
              return (
                <Button
                  key={b.brand}
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${b.short} (${b.full})`}
                  onClick={() => pickBrand(b.brand)}
                  variant="outlined"
                  sx={{
                    flexDirection: 'column',
                    py: 1.25,
                    textTransform: 'none',
                    borderRadius: 2,
                    borderWidth: 2,
                    borderColor: selected ? b.color : 'divider',
                    color: selected ? b.color : 'text.primary',
                    backgroundColor: selected ? `${b.color}14` : 'transparent',
                    '&:hover': { borderWidth: 2, borderColor: b.color },
                  }}
                >
                  <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: 'inherit' }}>{b.short}</Typography>
                  <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary', lineHeight: 1.2 }}>{b.full}</Typography>
                </Button>
              );
            })}
          </Box>
          <TextField
            label="Price (₹)"
            type="number"
            fullWidth
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputProps={{ inputMode: 'decimal', min: 0, step: 'any' }}
            // A prefilled last price is selected on tap, so typing replaces it
            // rather than appending (905 then 905 became 905905).
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSave) saveMutation.mutate();
            }}
          />
          <Autocomplete
            freeSolo
            options={sources}
            inputValue={source}
            onInputChange={(_, value) => setSource(value)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Taken from (optional)"
                placeholder="Agency, dealer, shop…"
                inputProps={{ ...params.inputProps, maxLength: 100 }}
              />
            )}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!canSave}
            onClick={() => saveMutation.mutate()}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {saveMutation.isPending ? 'Saving...' : editing ? 'Update Cylinder' : 'Save Cylinder'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!pendingDelete} onClose={() => setPendingDelete(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>Remove cylinder entry?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
            {pendingDelete && `${brandInfo(pendingDelete.brand).short} cylinder, ${formatRupees(pendingDelete.amount)}. `}
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
    </>
  );
}
