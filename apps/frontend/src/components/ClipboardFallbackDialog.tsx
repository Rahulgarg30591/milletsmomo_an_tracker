import { Dialog, DialogTitle, DialogContent, DialogActions, Typography, TextField, Button } from '@mui/material';
import { copyToClipboard } from '../utils/clipboard';

interface ClipboardFallbackDialogProps {
  /** The text that could not be copied; the dialog is open while it is set. */
  text: string | null;
  title: string;
  onClose: () => void;
  /** Called when a retry succeeds, e.g. to show a "copied" toast. */
  onCopied: () => void;
  onRetryFailed: () => void;
}

/** Shown when the clipboard is blocked: the text, selectable, with a retry. */
export default function ClipboardFallbackDialog({ text, title, onClose, onCopied, onRetryFailed }: ClipboardFallbackDialogProps) {
  if (text === null) return null;
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>{title}</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1.5 }}>
          Clipboard copy failed. Select the text below and copy manually.
        </Typography>
        <TextField
          multiline
          fullWidth
          rows={8}
          value={text}
          variant="outlined"
          inputProps={{ readOnly: true, sx: { fontSize: '0.85rem', fontFamily: 'monospace' } }}
          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={async () => {
            if (await copyToClipboard(text)) onCopied();
            else onRetryFailed();
          }}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          Retry Copy
        </Button>
        <Button onClick={onClose} sx={{ textTransform: 'none', fontWeight: 700 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
