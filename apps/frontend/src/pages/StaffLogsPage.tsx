import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Typography, Paper, useTheme } from '@mui/material';
import { ArrowLeft, Clock, User, MonitorSmartphone, Filter } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getStaffLogs } from '../api/staffLogApi';
import { getClientLogs, type ClientLogEntry } from '../api/clientLogApi';
import { getToday } from '../utils/dateUtils';
import type { StaffOperationLog } from '../types';

const staffTypeConfig: Record<string, { label: string; color: string; icon: string }> = {
  verification: { label: 'Verification', color: '#3B82F6', icon: '🚚' },
  closing_stock: { label: 'Closing Stock', color: '#10B981', icon: '📦' },
  order_create: { label: 'Order', color: '#F59E0B', icon: '📋' },
  order_update: { label: 'Order Edit', color: '#8B5CF6', icon: '✏️' },
  order_complete: { label: 'Order Done', color: '#10B981', icon: '✅' },
  order_delete: { label: 'Order Delete', color: '#EF4444', icon: '🗑️' },
  supply_order: { label: 'Supply Order', color: '#06B6D4', icon: '🛒' },
  payment_settlement: { label: 'Settlement', color: '#EC4899', icon: '💰' },
  expense_save: { label: 'Expenses', color: '#EC4899', icon: '💵' },
  login: { label: 'Login', color: '#22C55E', icon: '🔑' },
};

const clientTypeConfig: Record<string, { label: string; color: string }> = {
  login: { label: 'Login', color: '#22C55E' },
  logout: { label: 'Logout', color: '#EF4444' },
  page_view: { label: 'Page View', color: '#8B5CF6' },
  button_click: { label: 'Button', color: '#F97316' },
  navigation: { label: 'Navigate', color: '#06B6D4' },
  order_submit: { label: 'Order Sent', color: '#F59E0B' },
  order_complete: { label: 'Order Done', color: '#10B981' },
  verification_submit: { label: 'Verify', color: '#3B82F6' },
  closing_stock_submit: { label: 'Close Stock', color: '#8B5CF6' },
  action_start: { label: 'Start', color: '#6366F1' },
  action_end: { label: 'End', color: '#6366F1' },
  form_submit: { label: 'Form', color: '#EC4899' },
  revenue_check: { label: 'Revenue Check', color: '#F59E0B' },
  selection: { label: 'Selection', color: '#0EA5E9' },
  quantity_change: { label: 'Quantity', color: '#F97316' },
};

type UnifiedLog = {
  id: string;
  timestamp: string;
  source: 'staff' | 'client';
  type: string;
  label: string;
  color: string;
  icon?: string;
  user: string;
  role: string;
  details: string;
  metadata: Record<string, any> | null;
  deviceInfo: string | null;
  durationMs: number | null;
};

function toClientLogLabel(type: string): string {
  return clientTypeConfig[type]?.label || type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function toClientLogColor(type: string): string {
  return clientTypeConfig[type]?.color || '#6B7280';
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatMetadataShort(m: Record<string, any> | null): string {
  if (!m) return '';
  const parts: string[] = [];
  if (m.role) parts.push(m.role);
  if (m.displayName) parts.push(m.displayName);
  if (m.device) parts.push(m.device.split(',')[0]?.trim()?.replace('Platform: ', '') || '');
  if (m.sessionDurationMs) parts.push(formatDuration(m.sessionDurationMs));
  if (m.itemId) parts.push(`item:${m.itemId}`);
  if (m.reason) parts.push(m.reason);
  if (m.conflictCount !== undefined) parts.push(`${m.conflictCount} conflicts`);
  if (m.actionId) parts.push(`action:${m.actionId.slice(-6)}`);
  if (m.cashTotal !== undefined) parts.push(`₹${m.cashTotal} cash`);
  if (m.upiTotal !== undefined) parts.push(`₹${m.upiTotal} UPI`);
  if (m.totalRevenue !== undefined) parts.push(`₹${m.totalRevenue} total`);
  if (m.orderCount !== undefined) parts.push(`${m.orderCount} orders`);
  return parts.join(' · ');
}

export default function StaffLogsPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const [date, setDate] = useState(getToday());
  const [tab, setTab] = useState<'staff' | 'client'>('client');
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set());

  const { data: staffData } = useQuery({
    queryKey: ['staffLogs', date],
    queryFn: () => getStaffLogs(date),
    enabled: tab === 'staff',
  });

  const { data: clientData } = useQuery({
    queryKey: ['clientLogs', date],
    queryFn: () => getClientLogs(date),
    enabled: tab === 'client',
  });

  const staffLogs: UnifiedLog[] = useMemo(() =>
    (staffData?.logs ?? []).map((l: StaffOperationLog) => {
      const config = staffTypeConfig[l.operationType] || { label: l.operationType, color: '#6B7280', icon: '📝' };
      return {
        id: `s-${l.id}`,
        timestamp: l.createdAt,
        source: 'staff' as const,
        type: l.operationType,
        label: config.label,
        color: config.color,
        icon: config.icon,
        user: l.displayName,
        role: 'staff',
        details: l.details,
        metadata: null,
        deviceInfo: null,
        durationMs: null,
      };
    }), [staffData]);

  const clientLogs: UnifiedLog[] = useMemo(() =>
    (clientData?.logs ?? []).map((l: ClientLogEntry) => ({
      id: `c-${l.id}`,
      timestamp: l.createdAt,
      source: 'client' as const,
      type: l.type,
      label: toClientLogLabel(l.type),
      color: toClientLogColor(l.type),
      user: l.userRole || 'unknown',
      role: l.userRole || '',
      details: l.details || '',
      metadata: l.metadata,
      deviceInfo: l.deviceInfo,
      durationMs: l.durationMs,
    })), [clientData]);

  const rawLogs = tab === 'staff' ? staffLogs : clientLogs;

  const toggleFilter = (type: string) => {
    setSelectedFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const filteredLogs = selectedFilters.size > 0
    ? rawLogs.filter(l => selectedFilters.has(l.type))
    : rawLogs;

  interface LogGroup {
    key: string;
    label: string;
    logs: UnifiedLog[];
    startTime: string;
    endTime: string;
    user: string;
  }

  function extractOrderId(log: UnifiedLog): string | null {
    if (log.metadata?.orderId) return String(log.metadata.orderId);
    const m = log.details.match(/Order #(\d+)/);
    return m ? m[1] : null;
  }

  function extractSessionId(log: UnifiedLog): string | null {
    return log.metadata?.sessionId ? String(log.metadata.sessionId) : null;
  }

  // Sort ascending (oldest first) for timeline rendering
  const sortedFiltered = useMemo(() =>
    [...filteredLogs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
  [filteredLogs]);

  const logGroups: LogGroup[] = useMemo(() => {
    if (tab === 'staff') {
      // Group staff ops by order ID. Non-order ops grouped by type + 10-min window.
      const orderGroups = new Map<string, UnifiedLog[]>();
      const otherGroups: { key: string; label: string; logs: UnifiedLog[] }[] = [];

      for (const log of sortedFiltered) {
        const orderId = extractOrderId(log);
        if (orderId) {
          if (!orderGroups.has(orderId)) orderGroups.set(orderId, []);
          orderGroups.get(orderId)!.push(log);
        } else {
          // Group non-order logs by type within 10-min windows
          const t = new Date(log.timestamp).getTime();
          let bucket = otherGroups.find(g =>
            g.label.startsWith(log.label) &&
            g.logs.length > 0 &&
            t - new Date(g.logs[g.logs.length - 1].timestamp).getTime() <= 10 * 60 * 1000
          );
          if (!bucket) {
            bucket = { key: `other-${otherGroups.length}`, label: `${log.label}`, logs: [] };
            otherGroups.push(bucket);
          }
          bucket.logs.push(log);
        }
      }

      const groups: LogGroup[] = [];
      for (const [orderId, logs] of orderGroups) {
        groups.push({
          key: `order-${orderId}`,
          label: `Order #${orderId}`,
          logs,
          startTime: logs[0].timestamp,
          endTime: logs[logs.length - 1].timestamp,
          user: logs[0].user,
        });
      }
      for (const g of otherGroups) {
        groups.push({
          key: g.key,
          label: g.label,
          logs: g.logs,
          startTime: g.logs[0].timestamp,
          endTime: g.logs[g.logs.length - 1].timestamp,
          user: g.logs[0].user,
        });
      }
      // Sort groups by start time descending (most recent first)
      groups.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      return groups;
    } else {
      // Client logs: group by sessionId. Fallback: user + 5-min window.
      const sessionGroups = new Map<string, UnifiedLog[]>();
      const fallbackGroups: { key: string; label: string; logs: UnifiedLog[] }[] = [];

      for (const log of sortedFiltered) {
        const sid = extractSessionId(log);
        if (sid) {
          if (!sessionGroups.has(sid)) sessionGroups.set(sid, []);
          sessionGroups.get(sid)!.push(log);
        } else {
          const t = new Date(log.timestamp).getTime();
          let bucket = fallbackGroups.find(g =>
            g.logs.length > 0 &&
            g.logs[0].user === log.user &&
            t - new Date(g.logs[g.logs.length - 1].timestamp).getTime() <= 5 * 60 * 1000
          );
          if (!bucket) {
            bucket = { key: `fb-${fallbackGroups.length}`, label: log.user, logs: [] };
            fallbackGroups.push(bucket);
          }
          bucket.logs.push(log);
        }
      }

      const groups: LogGroup[] = [];
      for (const [sid, logs] of sessionGroups) {
        groups.push({
          key: `session-${sid}`,
          label: `${logs[0].user} session`,
          logs,
          startTime: logs[0].timestamp,
          endTime: logs[logs.length - 1].timestamp,
          user: logs[0].user,
        });
      }
      for (const g of fallbackGroups) {
        groups.push({
          key: g.key,
          label: g.label,
          logs: g.logs,
          startTime: g.logs[0].timestamp,
          endTime: g.logs[g.logs.length - 1].timestamp,
          user: g.logs[0].user,
        });
      }
      groups.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      return groups;
    }
  }, [sortedFiltered, tab]);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const staffCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of staffLogs) {
      counts[l.type] = (counts[l.type] || 0) + 1;
    }
    return counts;
  }, [staffLogs]);

  const clientCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of clientLogs) {
      counts[l.type] = (counts[l.type] || 0) + 1;
    }
    return counts;
  }, [clientLogs]);

  const counts = tab === 'staff' ? staffCounts : clientCounts;
  const typeConfig = tab === 'staff' ? staffTypeConfig : clientTypeConfig;

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', p: { xs: 1, md: 2 }, pb: { xs: 8, md: 4 } }}>
      <Box sx={{ maxWidth: 700, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 1.5, md: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 1 } }}>
            <Button
              size="small"
              startIcon={<ArrowLeft size={16} />}
              onClick={() => navigate('/admin')}
              sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary', minWidth: 0, px: 1 }}
            >
              Back
            </Button>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: '1rem', md: '1.25rem' }, color: 'text.primary', letterSpacing: '-0.3px' }}>
              Activity Logs
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
                width: 120,
                p: 0,
                '&::-webkit-calendar-picker-indicator': { filter: isDark ? 'invert(1)' : 'none', opacity: 0.6 },
              }}
            />
            {date === getToday() && (
              <Typography
                sx={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  color: 'success.main',
                  backgroundColor: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)',
                  px: 0.5,
                  py: 0.15,
                  borderRadius: 0.5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                Today
              </Typography>
            )}
          </Box>
        </Box>

        {/* Tab switcher */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            variant={tab === 'client' ? 'contained' : 'outlined'}
            size="small"
            startIcon={<MonitorSmartphone size={14} />}
            onClick={() => setTab('client')}
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1, fontSize: '0.8rem' }}
          >
            Staff Activity
          </Button>
          <Button
            variant={tab === 'staff' ? 'contained' : 'outlined'}
            size="small"
            startIcon={<User size={14} />}
            onClick={() => setTab('staff')}
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1, fontSize: '0.8rem' }}
          >
            Staff Operations
          </Button>
        </Box>

        {/* Activity filter chips */}
        {rawLogs.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 0.5, color: 'text.secondary' }}>
              <Filter size={12} />
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Filter
              </Typography>
            </Box>
            {Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
              const config = typeConfig[type] || { label: type, color: '#6B7280' };
              const isActive = selectedFilters.has(type);
              return (
                <Button
                  key={type}
                  size="small"
                  onClick={() => toggleFilter(type)}
                  sx={{
                    px: 0.75,
                    py: 0.25,
                    minWidth: 0,
                    borderRadius: 1,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    textTransform: 'none',
                    backgroundColor: isActive ? (isDark ? `${config.color}30` : `${config.color}20`) : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                    color: isActive ? config.color : (isDark ? '#9CA3AF' : '#6B7280'),
                    border: 1,
                    borderColor: isActive ? (isDark ? `${config.color}40` : `${config.color}30`) : 'transparent',
                    '&:hover': {
                      backgroundColor: isActive ? (isDark ? `${config.color}40` : `${config.color}30`) : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                    },
                  }}
                >
                  {config.label} {count}
                </Button>
              );
            })}
            {selectedFilters.size > 0 && (
              <Button
                size="small"
                onClick={() => setSelectedFilters(new Set())}
                sx={{
                  px: 0.75,
                  py: 0.25,
                  minWidth: 0,
                  borderRadius: 1,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  color: 'text.secondary',
                  ml: 0.5,
                }}
              >
                Clear
              </Button>
            )}
          </Box>
        )}

        {/* Logs list — grouped */}
        {filteredLogs.length === 0 ? (
          <Paper sx={{ borderRadius: 2, p: 3, textAlign: 'center', background: isDark ? 'rgba(255,255,255,0.03)' : undefined, border: 1, borderColor: 'divider' }}>
            <Typography sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.9rem' }}>
              No {tab === 'client' ? 'staff activity' : 'staff operation'} logs for this date
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {logGroups.map((group) => {
              const isCollapsed = collapsedGroups.has(group.key);
              const startT = new Date(group.startTime);
              const endT = new Date(group.endTime);
              const startStr = startT.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
              const endStr = endT.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
              const spanMs = endT.getTime() - startT.getTime();
              const spanStr = spanMs < 60000 ? `${Math.round(spanMs / 1000)}s` : `${Math.round(spanMs / 60000)}m`;
              const dur = spanMs > 0 ? `${startStr} → ${endStr} (${spanStr})` : startStr;

              return (
                <Paper
                  key={group.key}
                  sx={{
                    borderRadius: 2,
                    overflow: 'hidden',
                    border: 1,
                    borderColor: 'divider',
                    background: isDark ? 'rgba(255,255,255,0.02)' : undefined,
                  }}
                >
                  {/* Group header */}
                  <Box
                    onClick={() => toggleGroup(group.key)}
                    sx={{
                      p: { xs: 1, md: 1.25 },
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
                      borderBottom: isCollapsed ? 0 : 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', flexShrink: 0 }}>
                        {isCollapsed ? '▶' : '▼'}
                      </Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {group.label}
                      </Typography>
                      <Box
                        sx={{
                          px: 0.5,
                          py: 0.1,
                          borderRadius: 0.75,
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                          color: 'text.secondary',
                          flexShrink: 0,
                        }}
                      >
                        {group.logs.length}
                      </Box>
                    </Box>
                    <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', fontWeight: 500, flexShrink: 0, ml: 1 }}>
                      {dur}
                    </Typography>
                  </Box>

                  {/* Timeline entries */}
                  {!isCollapsed && (
                    <Box sx={{ p: { xs: 1, md: 1.25 }, pt: { xs: 0.5, md: 0.75 } }}>
                      {group.logs.map((log, idx) => {
                        const logTime = new Date(log.timestamp);
                        const timeStr = logTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                        const isLast = idx === group.logs.length - 1;

                        return (
                          <Box
                            key={log.id}
                            sx={{
                              display: 'flex',
                              gap: 1,
                              pb: isLast ? 0 : 1,
                              position: 'relative',
                            }}
                          >
                            {/* Timeline dot + line */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, pt: 0.25 }}>
                              <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: log.color, flexShrink: 0 }} />
                              {!isLast && (
                                <Box sx={{ width: 2, flex: 1, backgroundColor: 'divider', mt: 0.25, minHeight: 16 }} />
                              )}
                            </Box>

                            {/* Content */}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25, flexWrap: 'wrap' }}>
                                <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: log.color, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                  {log.icon ? `${log.icon} ` : ''}{log.label}
                                </Typography>
                                {tab === 'staff' && (
                                  <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', fontWeight: 600 }}>
                                    · {log.user}
                                  </Typography>
                                )}
                                <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', fontWeight: 500, ml: 'auto' }}>
                                  {timeStr}
                                </Typography>
                              </Box>
                              <Typography sx={{ fontSize: '0.8rem', color: 'text.primary', lineHeight: 1.4, fontWeight: 500, mb: 0.25 }}>
                                {log.details}
                              </Typography>
                              {(log.durationMs || log.metadata || log.deviceInfo) && (
                                <Typography sx={{ fontSize: '0.65rem', color: isDark ? '#9CA3AF' : '#6B7280', lineHeight: 1.4, fontWeight: 400 }}>
                                  {[
                                    log.durationMs ? `⏱ ${formatDuration(log.durationMs)}` : null,
                                    formatMetadataShort(log.metadata),
                                    log.deviceInfo ? `📱 ${log.deviceInfo.split(',')[0]?.replace('Platform: ', '')}` : null,
                                  ].filter(Boolean).join(' · ')}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                </Paper>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
}