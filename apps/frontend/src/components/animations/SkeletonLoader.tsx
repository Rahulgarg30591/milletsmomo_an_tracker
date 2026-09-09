import { Skeleton, Box, type BoxProps } from '@mui/material';
import { keyframes } from '@emotion/react';

// CSS rather than framer-motion: this renders on the first paint of the day
// view, and importing framer-motion here pulled ~126 kB onto that path.
const enter = keyframes`
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
`;

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
        <Box
          key={i}
          sx={animate ? {
            animation: `${enter} 260ms ease-out both`,
            animationDelay: `${i * 0.06}s`,
          } : undefined}
        >
          <Skeleton
            variant={variant}
            width={width}
            height={height}
            sx={{ mb: 1.5, borderRadius: 2 }}
            animation="wave"
          />
        </Box>
      ))}
    </Box>
  );
}