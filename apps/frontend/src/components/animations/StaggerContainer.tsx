import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import { Box } from '@mui/material';
import { animations } from '../../theme/tokens';

export default function StaggerContainer({
  children,
  className,
  delay = 0,
  sx,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box sx={sx}>
      <motion.div
        className={className}
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: animations.stagger.staggerChildren,
              delayChildren: delay || animations.stagger.delayChildren,
            },
          },
        }}
      >
        {children}
      </motion.div>
    </Box>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } },
      }}
    >
      {children}
    </motion.div>
  );
}