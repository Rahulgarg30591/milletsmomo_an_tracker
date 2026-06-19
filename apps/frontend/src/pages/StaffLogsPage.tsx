import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Typography, Paper, Chip, useTheme } from '@mui/material';
import { ArrowLeft, Clock, ClipboardList, Truck, Package, Filter } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getStaffLogs } from '../api/staffLogApi';
import { getToday } from '../utils/dateUtils';
import type { StaffOperationLog } from '../types';

const typeLabels: Record<string, { label: string; color: string; icon: React.ReactElement }> = {
  verification: { label: 'Verification', color: '#3B82F6', icon: <Truck size={14} /> },
  closing_stock: { label: 'Closing Stock', color: '#10B981', icon: <Package size={14} /> },
  order_create: { label: 'Order', color: '#F59E0B', icon: <ClipboardList size={14} /> },
};

export default function StaffLogsPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const [date, setDate] = useState(getToday());
  const [filterType, setFilterType] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['staffLogs', date, filterType],
    queryFn: () => getStaffLogs(date, filterType || undefined),
  });

  const logs = useMemo(() => data?.logs ?? [], [data]);

  const filteredLogs = useMemo(() => {
    if (!filterType) return logs;
    return logs.filter((l) => l.operationType === filterType);
  }, [logs, filterType]);

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', p: 1.5, pb: 2, pt: 1, overflowY: 'auto', '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none' }}>
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              size="small"
              startIcon={<ArrowLeft size={16} />}
              onClick={() => navigate('/admin')}
              sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary', minWidth: 0, px: 1 }}
            >
              Back
            </Button>
            <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', color: 'text.primary', letterSpacing: '-0.3px' }}>
              Staff Logs
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
            <Clock size={14} />
            <Box
              component="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              sx={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'inherit',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                cursor: 'pointer',
                width: 110,
                p: 0,
                '&::-webkit-calendar-picker-indicator': {
                  filter: isDark ? 'invert(1)' : 'none',
                  opacity: 0.6,
                },
              }}
            />
          </Box>
        </Box>

        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip
            icon={<Filter size={12} />}
            label="All"
            size="small"
            onClick={() => setFilterType(null)}
            sx={{
              fontWeight: 700,
              fontSize: '0.75rem',
              borderRadius: 1,
              height: 28,
              background: filterType === null ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)') : undefined,
              color: filterType === null ? 'text.primary' : 'text.secondary',
            }}
          />
          {Object.entries(typeLabels).map(([key, config]) => (
            <Chip
              key={key}
              icon={config.icon}
              label={config.label}
              size="small"
              onClick={() => setFilterType(filterType === key ? null : key)}
              sx={{
                fontWeight: 700,
                fontSize: '0.75rem',
                borderRadius: 1,
                height: 28,
                background: filterType === key ? (isDark ? `${config.color}25` : `${config.color}18`) : undefined,
                color: filterType === key ? config.color : 'text.secondary',
                border: `1px solid ${filterType === key ? config.color : 'transparent'}`,
              }}
            />
          ))}
        </Box>

        {/* Logs */}
        {filteredLogs.length === 0 ? (
          <Paper sx={{
            borderRadius: 2,
            p: 3,
            textAlign: 'center',
            background: isDark ? 'linear-gradient(135deg, #1E1E26 0%, #252530 100%)' : undefined,
            border: isDark ? '1px solid rgba(255,255,255,0.06)' : undefined,
          }}>
            <Typography sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.9rem' }}>
              No logs for this date
            </Typography>
          </Paper>
        ) : (
          <Paper sx={{
            borderRadius: 2,
            overflow: 'hidden',
            background: isDark ? 'linear-gradient(135deg, #1E1E26 0%, #252530 100%)' : undefined,
            border: isDark ? '1px solid rgba(255,255,255,0.06)' : undefined,
          }}>
            {filteredLogs.map((log: StaffOperationLog, index: number) => {
              const config = typeLabels[log.operationType] || typeLabels.order_create;
              const logTime = new Date(log.createdAt);
              const timeStr = logTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
              const dateStr = logTime.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

              return (
                <Box
                  key={log.id}
                  sx={{
                    p: 1.5,
                    borderBottom: index < filteredLogs.length - 1 ? 1 : 0,
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{
                        fontWeight: 700,
                        fontSize: '0.65rem',
                        px: 0.75,
                        py: 0.25,
                        borderRadius: 1,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        backgroundColor: isDark ? `${config.color}25` : `${config.color}18`,
                        color: config.color,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}>
                        {config.icon}
                        {config.label}
                      </Typography>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'text.primary' }}>
                        {log.displayName}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 500 }}>
                      {dateStr} {timeStr}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', lineHeight: 1.4, fontWeight: 500 }}>
                    {log.details}
                  </Typography>
                </Box>
              );
            })}
          </Paper>
        )}
      </Box>
    </Box>
  );
}
