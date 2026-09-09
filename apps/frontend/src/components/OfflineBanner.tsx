import { useState, useEffect } from 'react';
import { keyframes } from '@emotion/react';
import { WifiOff, Wifi, CloudOff, CloudCheck } from 'lucide-react';
import { Box, Typography } from '@mui/material';
import { getQueuedMutations, flushOfflineQueue, isOnline } from '../utils/offlineQueue';

// CSS rather than framer-motion: this banner is mounted app-wide, so the
// static import cost every page load ~126 kB. The previous AnimatePresence
// exit never ran regardless — the early return below unmounts the subtree
// before AnimatePresence can animate it out.
const slideDown = keyframes`
  from { opacity: 0; transform: translateY(-40px); }
  to   { opacity: 1; transform: translateY(0); }
`;

export default function OfflineBanner() {
  const [online, setOnline] = useState(isOnline());
  const [show, setShow] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const updateQueueCount = async () => {
      try {
        const mutations = await getQueuedMutations();
        setQueuedCount(mutations.length);
      } catch {
        // IndexedDB not available
      }
    };

    const handleOnline = async () => {
      setOnline(true);
      setShow(true);
      setSyncing(true);
      try {
        await flushOfflineQueue();
      } catch {
        // flush failed
      }
      setSyncing(false);
      await updateQueueCount();
      setTimeout(() => setShow(false), 2000);
    };

    const handleOffline = () => {
      setOnline(false);
      setShow(true);
      updateQueueCount();
    };

    // Poll queue count only when offline (queue only grows while offline).
    // When online, online/offline events + initial read keep the count fresh.
    const interval = setInterval(() => {
      if (!isOnline()) updateQueueCount();
    }, 5000);
    updateQueueCount();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (!show && queuedCount === 0) return null;

  return (
    <Box sx={{ animation: `${slideDown} 260ms ease-out both` }}>
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            py: 0.75,
            px: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            background: syncing
              ? 'linear-gradient(135deg, #1E40AF, #3B82F6)'
              : online
                ? 'linear-gradient(135deg, #064E3B, #2D8A4E)'
                : 'linear-gradient(135deg, #7F1D1D, #DC2626)',
            color: '#FFFFFF',
          }}
        >
          {syncing ? <CloudCheck size={16} /> : online ? <Wifi size={16} /> : <WifiOff size={16} />}
          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>
            {syncing
              ? 'Syncing offline data...'
              : online
                ? 'Back online'
                : 'No internet connection'}
          </Typography>
          {!online && queuedCount > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
              <CloudOff size={14} />
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                {queuedCount} action{queuedCount > 1 ? 's' : ''} queued
              </Typography>
            </Box>
          )}
        </Box>
    </Box>
  );
}