import { Button, Tooltip } from '@mui/material';
import { Bell, BellOff } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';

/** Admin header button that turns this device's push notifications on or off. */
export default function NotificationToggle() {
  const { state, error, enable, disable } = usePushNotifications();
  if (state === 'unsupported') return null;

  const label = state === 'on' ? 'Alerts on' : state === 'denied' ? 'Alerts blocked' : 'Alerts off';
  const hint = error
    ?? (state === 'denied'
      ? 'Notifications are blocked. Allow them in the browser’s site settings.'
      : state === 'on'
        ? 'This phone gets alerts for orders, stock, expenses and cash. Tap to turn off.'
        : 'Get alerts on this phone for orders, stock, expenses and cash.');

  return (
    <Tooltip title={hint}>
      <span>
        <Button
          size="small"
          variant={state === 'on' ? 'contained' : 'outlined'}
          color={error ? 'error' : 'primary'}
          disabled={state === 'busy' || state === 'denied'}
          startIcon={state === 'on' ? <Bell size={16} /> : <BellOff size={16} />}
          onClick={() => (state === 'on' ? disable() : enable())}
          aria-label={state === 'on' ? 'Turn off notifications' : 'Turn on notifications'}
          sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
        >
          {label}
        </Button>
      </span>
    </Tooltip>
  );
}
