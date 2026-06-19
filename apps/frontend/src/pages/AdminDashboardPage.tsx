import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { Box, Button, Typography, TextField, Paper, Chip, Table, TableBody, TableCell, TableHead, TableRow, IconButton, ToggleButton, ToggleButtonGroup, useTheme } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown, ArrowLeft, Download, TrendingUp, Package, Truck } from 'lucide-react';
import { getAdminSummary } from '../api/adminApi';
import { listSupplyOrders } from '../api/supplyApi';
import { getToday, getYesterday, addDays, formatDateLabel } from '../utils/dateUtils';
import StatChip from '../components/StatChip';
import SkeletonLoader from '../components/animations/SkeletonLoader';
import StaggerContainer, { StaggerItem } from '../components/animations/StaggerContainer';
import Toast from '../components/Toast';
import type { Order } from '../types';
import { vibrate, haptics, statusColors, darkStatusColors } from '../theme/tokens';

export default function AdminDashboardPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const sc = isDark ? darkStatusColors : statusColors;
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | '7days' | '30days' | 'custom'>('today');
  const [startDate, setStartDate] = useState(getToday());
  const [endDate, setEndDate] = useState(getToday());
  const [sortBy, setSortBy] = useState<'quantity' | 'revenue'>('quantity');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [filterPayment, setFilterPayment] = useState<'all' | 'cash' | 'upi' | 'pending'>('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const today = getToday();
    const yesterday = getYesterday();
    switch (dateRange) {
      case 'today':
        setStartDate(today);
        setEndDate(today);
        break;
      case 'yesterday':
        setStartDate(yesterday);
        setEndDate(yesterday);
        break;
      case '7days':
        setStartDate(addDays(today, -6));
        setEndDate(today);
        break;
      case '30days':
        setStartDate(addDays(today, -29));
        setEndDate(today);
        break;
    }
  }, [dateRange]);

  const { data, isLoading } = useQuery({
    queryKey: ['adminSummary', startDate, endDate],
    queryFn: () => getAdminSummary(startDate, endDate),
  });

  const { data: supplyOrders = [] } = useQuery({
    queryKey: ['supplyOrders', startDate, endDate],
    queryFn: () => listSupplyOrders(startDate, endDate),
  });

  const sortedItems = useMemo(() => {
    if (!data?.itemBreakdown) return [];
    const items = [...data.itemBreakdown];
    items.sort((a, b) => {
      const aVal = sortBy === 'quantity' ? a.totalQuantity : a.totalRevenue;
      const bVal = sortBy === 'quantity' ? b.totalQuantity : b.totalRevenue;
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
    return items;
  }, [data, sortBy, sortDir]);

  const filteredOrders = useMemo(() => {
    if (!data?.orders) return [];
    if (filterPayment === 'all') return data.orders;
    return data.orders.filter((o: Order) => o.paymentMethod === filterPayment);
  }, [data, filterPayment]);

  const toggleSort = (field: 'quantity' | 'revenue') => {
    vibrate(haptics.light);
    if (sortBy === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const handleExport = () => {
    vibrate(haptics.light);
    if (!filteredOrders.length) {
      setToast({ message: 'No orders to export', type: 'error' });
      return;
    }
    const rows = [
      ['Time', 'Type', 'Payment', 'Status', 'Items', 'Amount'],
      ...filteredOrders.map((o: Order) => [
        o.timeLabel,
        o.orderType === 'dine' ? 'Dine' : 'Pack',
        o.paymentMethod,
        o.isCompleted ? 'Completed' : 'Pending',
        o.items.map((i) => `${i.quantity}x ${i.itemName}${i.isHalf ? ' (½)' : ''}`).join(', '),
        `₹${o.totalAmount}`,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `orders_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setToast({ message: 'CSV exported!', type: 'success' });
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', p: 1.5, pb: 2, pt: 1, overflowY: 'auto', '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none' }}>
      <Box sx={{ maxWidth: 960, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              size="small"
              startIcon={<ArrowLeft size={16} />}
              onClick={() => navigate('/login')}
              sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary', minWidth: 0, px: 1 }}
            >
              Back
            </Button>
            <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', color: 'text.primary', letterSpacing: '-0.3px' }}>
              Dashboard
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Truck size={16} />}
              onClick={() => navigate(`/admin/supply?date=${startDate}`)}
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
            >
              Supply
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Download size={16} />}
              onClick={handleExport}
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
            >
              Export
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Package size={16} />}
              onClick={() => navigate('/admin/staff-logs')}
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
            >
              Logs
            </Button>
          </Box>
        </Box>

        {/* Date range selector */}
        <Box sx={{ mb: 2 }}>
          <ToggleButtonGroup
            value={dateRange}
            exclusive
            onChange={(_e, val) => val && setDateRange(val)}
            size="small"
            sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5, '& .MuiToggleButtonGroup-grouped': { borderRadius: 2, border: 0, mx: 0.25 } }}
          >
            <ToggleButton value="today">Today</ToggleButton>
            <ToggleButton value="yesterday">Yesterday</ToggleButton>
            <ToggleButton value="7days">7 Days</ToggleButton>
            <ToggleButton value="30days">30 Days</ToggleButton>
            <ToggleButton value="custom">Custom</ToggleButton>
          </ToggleButtonGroup>

          {dateRange === 'custom' && (
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                type="date"
                size="small"
                label="From"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                InputLabelProps={{ shrink: true }}
              />
              <Typography sx={{ color: 'text.secondary' }}>to</Typography>
              <TextField
                type="date"
                size="small"
                label="To"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          )}
        </Box>

        {isLoading && !data && (
          <>
            <SkeletonLoader count={4} height={64} sx={{ mb: 2, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1 }} />
            <SkeletonLoader count={1} height={300} />
          </>
        )}

        {data && (
          <>
            {/* Stats grid */}
            <StaggerContainer
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
                gap: 1,
                mb: 2,
              }}
            >
              <StaggerItem>
                <StatChip
                  label="Total Orders"
                  value={data.totalOrders}
                  icon="orders"
                  color="primary"
                />
              </StaggerItem>
              <StaggerItem>
                <StatChip
                  label="Revenue"
                  value={`₹${data.totalRevenue}`}
                  icon="revenue"
                  color="accent"
                />
              </StaggerItem>
              <StaggerItem>
                <StatChip
                  label="Pending"
                  value={`₹${data.pendingAmount}`}
                  icon="pending"
                  color="error"
                />
              </StaggerItem>
              <StaggerItem>
                <StatChip
                  label="Cash / UPI"
                  value={`₹${data.cashTotal} / ₹${data.upiTotal}`}
                  icon="payment"
                  color="success"
                />
              </StaggerItem>
            </StaggerContainer>

            {/* Supply Orders */}
            <Paper sx={{
              borderRadius: 2,
              overflow: 'hidden',
              mb: 2,
              background: isDark ? 'linear-gradient(135deg, #1E1E26 0%, #252530 100%)' : undefined,
              border: isDark ? '1px solid rgba(255,255,255,0.06)' : undefined,
            }}>
              <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Truck size={16} style={{ color: isDark ? '#4ADE80' : '#1B6B3A' }} />
                  <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary' }}>
                    Supply Orders
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => navigate(`/admin/supply?date=${startDate}`)}
                  sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', minWidth: 0, px: 1 }}
                >
                  + New
                </Button>
              </Box>
              <Box sx={{ p: 1.5, pt: 0.5 }}>
                {supplyOrders.length > 0 ? supplyOrders.map((order) => {
                  const momos = order.items
                    .filter((i) => i.category === 'momo_packet')
                    .reduce((sum, i) => sum + i.quantity * i.piecesPer, 0);
                  return (
                    <Box
                      key={order.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        py: 1,
                        borderBottom: 1,
                        borderColor: 'divider',
                        '&:last-child': { borderBottom: 0 },
                        cursor: 'pointer',
                        '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F9FAFB' },
                        borderRadius: 1,
                        px: 0.5,
                        mx: -0.5,
                        transition: 'background-color 0.15s ease',
                      }}
                      onClick={() => navigate(`/admin/supply?date=${order.orderDate}`)}
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.primary' }}>
                          {formatDateLabel(order.orderDate)}
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                          {momos > 0 && ` · ${momos} momos`}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: 'primary.main' }}>
                        ₹{order.totalCost.toLocaleString()}
                      </Typography>
                    </Box>
                  );
                }) : (
                  <Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 2, fontSize: '0.85rem' }}>
                    No supply orders for this period
                  </Typography>
                )}
              </Box>
            </Paper>

            {/* Revenue chart */}
            <Paper sx={{
              borderRadius: 2,
              p: 2,
              mb: 2,
              overflow: 'hidden',
              background: isDark ? 'linear-gradient(135deg, #1E1E26 0%, #252530 100%)' : undefined,
              border: isDark ? '1px solid rgba(255,255,255,0.06)' : undefined,
            }}>
              <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 1.5 }}>
                Payment Split
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                <Box
                  sx={{
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    position: 'relative',
                    flexShrink: 0,
                    boxShadow: isDark ? '0 0 24px rgba(45,138,78,0.15)' : 'none',
                    background: `conic-gradient(
                      ${isDark ? '#2D8A4E' : '#1B6B3A'} 0deg ${(data.cashTotal / (data.totalRevenue || 1)) * 360}deg,
                      ${isDark ? '#7C5CFF' : '#5B21B6'} ${(data.cashTotal / (data.totalRevenue || 1)) * 360}deg ${((data.cashTotal + data.upiTotal) / (data.totalRevenue || 1)) * 360}deg,
                      ${isDark ? '#E85757' : '#DC2626'} ${((data.cashTotal + data.upiTotal) / (data.totalRevenue || 1)) * 360}deg 360deg
                    )`,
                  }}
                />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: 1, backgroundColor: isDark ? '#2D8A4E' : '#1B6B3A' }} />
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                      Cash: ₹{data.cashTotal}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: 1, backgroundColor: isDark ? '#7C5CFF' : '#5B21B6' }} />
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                      UPI: ₹{data.upiTotal}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: 1, backgroundColor: isDark ? '#E85757' : '#DC2626' }} />
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                      Pending: ₹{data.pendingAmount}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Paper>

            {/* Item breakdown table */}
            <Paper sx={{
              borderRadius: 2,
              overflow: 'hidden',
              mb: 2,
              background: isDark ? 'linear-gradient(135deg, #1E1E26 0%, #252530 100%)' : undefined,
              border: isDark ? '1px solid rgba(255,255,255,0.06)' : undefined,
            }}>
              <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary' }}>
                  Item Breakdown
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <IconButton size="small" onClick={() => toggleSort('quantity')} sx={{ color: sortBy === 'quantity' ? 'primary.main' : 'text.secondary' }}>
                    <ArrowUpDown size={16} />
                  </IconButton>
                  <IconButton size="small" onClick={() => toggleSort('revenue')} sx={{ color: sortBy === 'revenue' ? 'primary.main' : 'text.secondary' }}>
                    <TrendingUp size={16} />
                  </IconButton>
                </Box>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F9FAFB' }}>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}>Item</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}>Qty</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}>Revenue</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedItems.map((item, idx: number) => (
                    <TableRow
                      key={idx}
                      sx={{
                        '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F9FAFB' },
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <TableCell sx={{ fontSize: '0.85rem', color: 'text.primary', fontWeight: 500, py: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Package size={14} color="currentColor" style={{ opacity: 0.4 }} />
                          {item.itemName}
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'primary.main', py: 1 }}>
                        {item.totalQuantity}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'primary.main', py: 1 }}>
                        ₹{item.totalRevenue}
                      </TableCell>
                    </TableRow>
                  ))}
                  {sortedItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} sx={{ color: 'text.secondary', textAlign: 'center', py: 4, fontSize: '0.9rem' }}>
                        No orders for this date range
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>

            {/* Orders list */}
            <Paper sx={{
              borderRadius: 2,
              overflow: 'hidden',
              background: isDark ? 'linear-gradient(135deg, #1E1E26 0%, #252530 100%)' : undefined,
              border: isDark ? '1px solid rgba(255,255,255,0.06)' : undefined,
            }}>
              <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary' }}>
                  Orders
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {(['all', 'cash', 'upi', 'pending'] as const).map((f) => (
                    <Chip
                      key={f}
                      label={f === 'all' ? 'All' : f}
                      size="small"
                      onClick={() => setFilterPayment(f)}
                      color={filterPayment === f ? 'primary' : 'default'}
                      variant={filterPayment === f ? 'filled' : 'outlined'}
                      sx={{ fontWeight: 600, textTransform: 'capitalize', fontSize: '0.75rem' }}
                    />
                  ))}
                </Box>
              </Box>
              <Box sx={{ p: 1.5 }}>
                {filteredOrders.map((order: Order) => (
                  <Box
                    key={order.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      py: 1,
                      borderBottom: 1,
                      borderColor: 'divider',
                      '&:last-child': { borderBottom: 0 },
                      '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F9FAFB' },
                      transition: 'background-color 0.15s ease',
                      px: 0.5,
                      mx: -0.5,
                      borderRadius: 1,
                    }}
                  >
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.primary' }}>
                          {order.timeLabel}
                        </Typography>
                        <Chip
                          size="small"
                          label={order.orderType === 'dine' ? 'Dine' : 'Pack'}
                          sx={{
                            height: 20,
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            backgroundColor: order.orderType === 'dine' ? sc.dineIn.bg : sc.pack.bg,
                            color: order.orderType === 'dine' ? sc.dineIn.fg : sc.pack.fg,
                          }}
                        />
                        <Chip
                          size="small"
                          label={order.paymentMethod}
                          sx={{
                            height: 20,
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            backgroundColor: order.paymentMethod === 'cash' ? sc.cash.bg : order.paymentMethod === 'upi' ? sc.upi.bg : sc.pending.bg,
                            color: order.paymentMethod === 'cash' ? sc.cash.fg : order.paymentMethod === 'upi' ? sc.upi.fg : sc.pending.fg,
                            textTransform: 'capitalize',
                          }}
                        />
                        {order.isCompleted && (
                          <Chip
                            size="small"
                            label="Done"
                            sx={{
                              height: 20,
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              backgroundColor: sc.completed.bg,
                              color: sc.completed.fg,
                            }}
                          />
                        )}
                      </Box>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                        {order.items.map((i) => `${i.quantity}x ${i.itemName}${i.isHalf ? ' (½)' : ''}`).join(', ')}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: 'primary.main' }}>
                      ₹{order.totalAmount}
                    </Typography>
                  </Box>
                ))}
                {filteredOrders.length === 0 && (
                  <Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 4, fontSize: '0.9rem' }}>
                    No orders match the selected filter
                  </Typography>
                )}
              </Box>
            </Paper>
          </>
        )}
      </Box>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Box>
  );
}