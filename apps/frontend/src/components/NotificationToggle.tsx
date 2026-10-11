import { useState } from 'react';
import { Badge, CircularProgress, IconButton, Tooltip } from '@mui/material';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import Toast from './Toast';
import { haptics, vibrate } from '../theme/tokens';

/**
 * App-bar bell for admin. Off: grey, crossed out. On: green, filled, with a
 * dot. Tapping turns alerts on (and sends a test) or off; the result is toasted.
 */
export default function NotificationToggle() {
  const { state, enable, disable } = usePushNotifications();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  if (state === 'unsupported') return null;

  const on = state === 'on';
  const label = on ? 'Alerts on — tap to turn off' : state === 'denied' ? 'Alerts blocked in Chrome settings' : 'Turn on alerts';

  const handleClick = async () => {
    vibrate(haptics.light);
    if (state === 'denied') {
      setToast({ message: 'Notifications are blocked. Chrome ⋮ → Settings → Site settings → Notifications → allow this app.', type: 'error' });
      return;
    }
    const result = on ? await disable() : await enable();
    setToast({ message: result.message, type: result.ok ? 'success' : 'error' });
  };

  return (
    <>
      <Tooltip title={label}>
        <span>
          <IconButton
            onClick={handleClick}
            disabled={state === 'busy'}
            size="small"
            aria-label={label}
            aria-pressed={on}
            data-state={state}
            sx={{
              minWidth: 40,
              minHeight: 40,
              color: on ? 'primary.contrastText' : 'text.disabled',
              backgroundColor: on ? 'primary.main' : 'transparent',
              opacity: state === 'denied' ? 0.5 : 1,
              '&:hover': { backgroundColor: on ? 'primary.dark' : 'action.hover' },
            }}
          >
            {state === 'busy' ? (
              <CircularProgress size={16} color="inherit" />
            ) : on ? (
              <Badge variant="dot" color="warning" overlap="circular">
                <BellRing size={18} />
              </Badge>
            ) : state === 'denied' ? (
              <BellOff size={18} />
            ) : (
              <Bell size={18} />
            )}
          </IconButton>
        </span>
      </Tooltip>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
