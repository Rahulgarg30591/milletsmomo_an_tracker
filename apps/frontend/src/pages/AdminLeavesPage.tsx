import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Typography, Paper, IconButton, TextField, useTheme,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { ArrowLeft, CalendarX2, Pencil, Trash2, Plus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { errorDetail } from '../utils/errors';
import { getLeaveMonth, addLeave, updateLeave, deleteLeave } from '../api/staffApi';
import { formatDateLabel, getToday } from '../utils/dateUtils';
import { trackPageView } from '../utils/tracking';
import MonthPicker, { monthLabel, useMonthParam } from '../components/MonthPicker';
import StaffNameField from '../components/StaffNameField';
import SkeletonLoader from '../components/animations/SkeletonLoader';
import Toast from '../components/Toast';
import { vibrate, haptics } from '../theme/tokens';
import type { StaffLeave } from '../types';


/** Admin marks staff absent, to count the leaves each person takes. */
export default function AdminLeavesPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [month, setMonth, currentMonth] = useMonthParam();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StaffLeave | null>(null);
  const [staffName, setStaffName] = useState('');
  const [leaveDate, setLeaveDate] = useState(getToday());
  const [reason, setReason] = useState('');
  const [nameError, setNameError] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<StaffLeave | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ['staffLeaves', month],
    queryFn: () => getLeaveMonth(month),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    trackPageView('admin_leaves', `Viewed staff leaves for ${month}`);
  }, [month]);

  const openAdd = () => {
    vibrate(haptics.light);
    setEditing(null);
    setStaffName('');
    setLeaveDate(getToday());
    setReason('');
    setNameError(false);
    setDialogOpen(true);
  };

  const openEdit = (leave: StaffLeave) => {
    vibrate(haptics.light);
    setEditing(leave);
    setStaffName(leave.staffName);
    setLeaveDate(leave.leaveDate);
    setReason(leave.reason ?? '');
    setNameError(false);
    setDialogOpen(true);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['staffLeaves'] });
    qc.invalidateQueries({ queryKey: ['staffNames'] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const input = { staffName: staffName.trim(), leaveDate, reason: reason.trim() || null };
      return editing ? updateLeave(editing.id, input) : addLeave(input);
    },
    onSuccess: (leave) => {
      vibrate(haptics.success);
      setToast({ message: `${leave.staffName} ${editing ? 'leave updated' : 'marked absent'}`, type: 'success' });
      setDialogOpen(false);
      invalidate();
      // Show the month the leave landed in.
      if (leave.leaveDate.slice(0, 7) !== month) setMonth(leave.leaveDate.slice(0, 7));
    },
    onError: (error) => {
      vibrate(haptics.error);
      setToast({ message: errorDetail(error) ?? 'Failed to save leave', type: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteLeave(id),
    onSuccess: () => {
      vibrate(haptics.success);
      setToast({ message: 'Leave removed', type: 'success' });
      setPendingDelete(null);
      invalidate();
    },
    onError: () => {
      vibrate(haptics.error);
      setToast({ message: 'Failed to remove leave', type: 'error' });
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
  const leaveColor = isDark ? '#F87171' : '#DC2626';

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
            Staff Leaves
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<Plus size={16} />}
            onClick={openAdd}
            sx={{ ml: 'auto', textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
          >
            Mark Absent
          </Button>
        </Box>

        <MonthPicker month={month} currentMonth={currentMonth} onChange={setMonth} />

        {isLoading ? (
          <SkeletonLoader count={3} height={64} />
        ) : isError || !report ? (
          <Typography sx={{ color: 'error.main', textAlign: 'center', mt: 4 }}>
            Couldn{'’'}t load staff leaves.
          </Typography>
        ) : (
          <>
            <Paper sx={{ p: 2, borderRadius: 2, mb: 2, border: cardBorder }}>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 600 }}>
                {monthLabel(month)}
              </Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '1.6rem', color: 'text.primary' }} data-testid="leave-month-count">
                {report.count} {report.count === 1 ? 'leave' : 'leaves'}
              </Typography>
              {report.byStaff.length > 0 && (
                <Box sx={{ mt: 1, borderTop: 1, borderColor: 'divider' }}>
                  {report.byStaff.map((s) => (
                    <Box
                      key={s.staffName}
                      data-testid="leave-staff-row"
                      sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}
                    >
                      <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: 'text.primary' }}>{s.staffName}</Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: leaveColor }}>
                        {s.count} {s.count === 1 ? 'day' : 'days'}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>

            {report.leaves.length === 0 ? (
              <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 2, border: `2px dashed ${theme.palette.divider}`, background: 'transparent' }}>
                <CalendarX2 size={20} color={theme.palette.text.secondary} />
                <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', mt: 0.5 }}>
                  No leaves in {monthLabel(month)}.
                </Typography>
              </Paper>
            ) : (
              <Paper sx={{ borderRadius: 2, overflow: 'hidden', border: cardBorder }}>
                {report.leaves.map((l) => (
                  <Box
                    key={l.id}
                    data-testid="leave-row"
                    sx={{ px: 1.5, py: 1.25, display: 'flex', alignItems: 'center', gap: 1, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}
                  >
                    <Box sx={{ width: 6, alignSelf: 'stretch', borderRadius: 1, backgroundColor: leaveColor }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'text.primary' }}>
                        {l.staffName} · {formatDateLabel(l.leaveDate)}
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: l.reason ? 'text.primary' : 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.reason ?? 'No reason given'}
                      </Typography>
                      <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                        by {l.createdByName}{l.updatedAt && ` · edited${l.updatedByName ? ` by ${l.updatedByName}` : ''}`}
                      </Typography>
                    </Box>
                    <IconButton size="small" aria-label={`Edit leave for ${l.staffName}`} onClick={() => openEdit(l)} sx={{ color: 'text.secondary' }}>
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton size="small" aria-label={`Remove leave for ${l.staffName}`} onClick={() => setPendingDelete(l)} sx={{ color: 'error.main' }}>
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
          {editing ? 'Edit leave' : 'Mark staff absent'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
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
            value={leaveDate}
            onChange={(e) => e.target.value && setLeaveDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Sick, family function…"
            inputProps={{ maxLength: 200 }}
            multiline
            maxRows={3}
          />
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
            {saveMutation.isPending ? 'Saving...' : editing ? 'Update Leave' : 'Mark Absent'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!pendingDelete} onClose={() => setPendingDelete(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>Remove this leave?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
            {pendingDelete && `${pendingDelete.staffName}, ${formatDateLabel(pendingDelete.leaveDate)}. `}
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
