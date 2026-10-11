import { useState } from 'react';
import { Button } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { fetchDaySummary } from '../utils/daySummary';
import { copyToClipboard } from '../utils/clipboard';
import { vibrate, haptics } from '../theme/tokens';
import ClipboardFallbackDialog from './ClipboardFallbackDialog';
import Toast from './Toast';

/** Copies sale details, expenses and closing stock for one day as a single message. */
export default function CopyDaySummaryButton({ date, variant = 'contained' }: { date: string; variant?: 'contained' | 'outlined' }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleClick = async () => {
    vibrate(haptics.light);
    setBusy(true);
    try {
      const text = await fetchDaySummary(qc, date);
      if (await copyToClipboard(text)) {
        vibrate(haptics.success);
        setToast({ message: 'Day summary copied to clipboard!', type: 'success' });
      } else {
        setFallback(text);
      }
    } catch {
      setToast({ message: 'Couldn’t load the day summary', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        size="small"
        variant={variant}
        startIcon={<ClipboardList size={16} />}
        disabled={busy}
        onClick={handleClick}
        sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
      >
        {busy ? 'Copying…' : 'Copy Day Summary'}
      </Button>
      <ClipboardFallbackDialog
        text={fallback}
        title="Copy Day Summary"
        onClose={() => setFallback(null)}
        onCopied={() => {
          vibrate(haptics.success);
          setToast({ message: 'Day summary copied to clipboard!', type: 'success' });
          setFallback(null);
        }}
        onRetryFailed={() => setToast({ message: 'Copy failed — select text manually', type: 'error' })}
      />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
