import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi } from 'lucide-react';
import { Box, Typography } from '@mui/material';

export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      setShow(true);
      setTimeout(() => setShow(false), 2000);
    };
    const handleOffline = () => {
      setOnline(false);
      setShow(true);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            py: 1,
            px: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            background: online
              ? 'linear-gradient(135deg, #064E3B, #2D8A4E)'
              : 'linear-gradient(135deg, #7F1D1D, #DC2626)',
            color: '#FFFFFF',
          }}
        >
          {online ? <Wifi size={16} /> : <WifiOff size={16} />}
          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>
            {online ? 'Back online' : 'No internet connection'}
          </Typography>
        </Box>
      </motion.div>
    </AnimatePresence>
  );
}