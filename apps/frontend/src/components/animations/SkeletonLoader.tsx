import { motion } from 'framer-motion';
import { Skeleton, Box, type BoxProps } from '@mui/material';

interface SkeletonLoaderProps extends BoxProps {
  count?: number;
  height?: number | string;
  width?: number | string;
  variant?: 'text' | 'rectangular' | 'rounded' | 'circular';
  animate?: boolean;
}

export default function SkeletonLoader({
  count = 1,
  height = 60,
  width = '100%',
  variant = 'rounded',
  animate = true,
  ...boxProps
}: SkeletonLoaderProps) {
  return (
    <Box {...boxProps}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={animate ? { opacity: 0, x: -8 } : false}
          animate={animate ? { opacity: 1, x: 0 } : false}
          transition={{ delay: i * 0.06, type: 'spring', stiffness: 400, damping: 30 }}
        >
          <Skeleton
            variant={variant}
            width={width}
            height={height}
            sx={{ mb: 1.5, borderRadius: 2 }}
            animation="wave"
          />
        </motion.div>
      ))}
    </Box>
  );
}