import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { Box, Button, Typography, TextField, Paper, Chip, Table, TableBody, TableCell, TableHead, TableRow, IconButton, ToggleButton, ToggleButtonGroup, useTheme, Tooltip as MuiTooltip, Fade, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown, ArrowLeft, Download, TrendingUp, Package, Truck, List, Maximize2, X } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { getAdminSummary } from '../api/adminApi';
import { listSupplyOrders, getSupplyOrderLogs } from '../api/supplyApi';
import { listSupplyVerifications } from '../api/supplyVerificationApi';
import { getStaffLogs } from '../api/staffLogApi';
import { getMenu } from '../api/menuApi';
import { getToday, getYesterday, addDays, formatDateLabel } from '../utils/dateUtils';
import { formatQuantity } from '../utils/formatQuantity';
import { exportDashboardToExcel } from '../utils/exportDashboard';
import StatChip from '../components/StatChip';
import SkeletonLoader from '../components/animations/SkeletonLoader';
import StaggerContainer, { StaggerItem } from '../components/animations/StaggerContainer';
import Toast from '../components/Toast';
import type { Order, MenuItem, SupplyOrder, SupplyOrderItem } from '../types';
import { vibrate, haptics, statusColors, darkStatusColors } from '../theme/tokens';

const ITEM_CHART_COLORS = [
  '#6B8E6B', '#7FA37F', '#8FBF8F', '#A8C9A8',
  '#B89A6A', '#C4A97C', '#D4B88E', '#E0C8A0',
  '#8B7FA8', '#9B8FB8', '#AB9FC8', '#BBAFD8',
  '#A87B8B', '#B88B9B', '#C89BAB', '#D8ABBB',
  '#6B9B8A', '#7AABA0', '#8BB9A8', '#9CC9B8',
  '#7B8EA8', '#8B9EB8', '#9BAEC8', '#ABBED8',
];

const PREP_ORDER = ['Steam', 'Fry', 'Creamy', 'Creamy Fry', 'Nepalese Kothey', 'Pan Fried Gravy'];
const FILL_ORDER = ['Veg', 'Paneer', 'Cheese Corn', 'Platter'];

const CATEGORY_COLORS: Record<string, string> = {
  'Steam': '#6B8E6B',
  'Fry': '#B89A6A',
  'Creamy': '#8B7FA8',
  'Creamy Fry': '#A87B8B',
  'Nepalese Kothey': '#6B9B8A',
  'Pan Fried Gravy': '#7B8EA8',
};

const FILLING_COLORS: Record<string, string> = {
  'Veg': '#6B8E6B',
  'Paneer': '#B89A6A',
  'Cheese Corn': '#7B8EA8',
};

interface ChartDatum {
  name: string;
  value: number;
  quantity?: number;
  color: string;
  hidden?: boolean;
}

export default function AdminDashboardPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const sc = isDark ? darkStatusColors : statusColors;
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | '7days' | '30days' | 'custom'>('today');
  const [startDate, setStartDate] = useState(getToday());
  const [endDate, setEndDate] = useState(getToday());
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'revenue'>('name');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('asc');
  const [filterPayment, setFilterPayment] = useState<'all' | 'cash' | 'upi' | 'pending'>('all');
  const [fillingView, setFillingView] = useState<'plates' | 'orders' | 'quantities'>('quantities');
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set());
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [activePieSlice, setActivePieSlice] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [chartTypes, setChartTypes] = useState<Record<string, 'pie' | 'donut'>>({ payment: 'donut', item: 'donut', category: 'donut', filling: 'donut' });
  const [modalChart, setModalChart] = useState<{ title: string; data: ChartDatum[]; chartId: string; type: 'pie' | 'bar' | 'line' | 'area' } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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

  const { data: supplyOrders = [] as SupplyOrder[] } = useQuery({
    queryKey: ['supplyOrders', startDate, endDate],
    queryFn: () => listSupplyOrders(startDate, endDate),
  });

  const { data: supplyVerifications = [] } = useQuery({
    queryKey: ['supplyVerifications', startDate, endDate],
    queryFn: () => listSupplyVerifications(startDate, endDate),
  });

  const { data: staffLogsData } = useQuery({
    queryKey: ['staffLogs', startDate],
    queryFn: () => getStaffLogs(startDate),
  });
  const staffLogs = staffLogsData?.logs || [];

  const { data: supplyLogs = [] } = useQuery({
    queryKey: ['supplyLogs', startDate],
    queryFn: () => getSupplyOrderLogs(startDate),
  });

  const { data: menuData } = useQuery({
    queryKey: ['menu'],
    queryFn: getMenu,
  });

  const allItemsBreakdown = useMemo<{ itemName: string; totalQuantity: number; totalRevenue: number; preparation: string; filling: string }[]>(() => {
    if (!menuData?.items) return [];
    const orderedMap = new Map<string, { totalQuantity: number; totalRevenue: number }>(
      (data?.itemBreakdown || []).map((i: { itemName: string; totalQuantity: number; totalRevenue: number }) => [i.itemName, i])
    );
    return (menuData.items as MenuItem[]).map((item) => {
      const ordered = orderedMap.get(item.displayName);
      return {
        itemName: `${item.preparation} ${item.filling}`,
        totalQuantity: ordered?.totalQuantity || 0,
        totalRevenue: ordered?.totalRevenue || 0,
        preparation: item.preparation,
        filling: item.filling,
      };
    });
  }, [menuData, data]);

  const sortedAllItems = useMemo(() => {
    const items = [...allItemsBreakdown];
    if (sortBy === 'name') {
      items.sort((a, b) => {
        const prepA = PREP_ORDER.indexOf(a.preparation);
        const prepB = PREP_ORDER.indexOf(b.preparation);
        if (prepA !== prepB) return sortDir === 'desc' ? prepB - prepA : prepA - prepB;
        const fillA = FILL_ORDER.indexOf(a.filling);
        const fillB = FILL_ORDER.indexOf(b.filling);
        return sortDir === 'desc' ? fillB - fillA : fillA - fillB;
      });
    } else {
      items.sort((a, b) => {
        const aVal = sortBy === 'quantity' ? a.totalQuantity : a.totalRevenue;
        const bVal = sortBy === 'quantity' ? b.totalQuantity : b.totalRevenue;
        return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }
    return items;
  }, [allItemsBreakdown, sortBy, sortDir]);

  const visibleItems = useMemo(() => allItemsBreakdown.filter((i) => !hiddenItems.has(i.itemName)), [allItemsBreakdown, hiddenItems]);

  const categoryData = useMemo(() => {
    const cats: Record<string, { totalRevenue: number; totalQuantity: number }> = {};
    for (const item of allItemsBreakdown) {
      if (hiddenItems.has(item.itemName)) continue;
      if (!cats[item.preparation]) {
        cats[item.preparation] = { totalRevenue: 0, totalQuantity: 0 };
      }
      cats[item.preparation].totalRevenue += item.totalRevenue;
      cats[item.preparation].totalQuantity += item.totalQuantity;
    }
    return PREP_ORDER
      .map((prep) => ({ name: prep, totalRevenue: cats[prep]?.totalRevenue || 0, totalQuantity: cats[prep]?.totalQuantity || 0 }))
      .filter((c) => c.totalRevenue > 0);
  }, [allItemsBreakdown, hiddenItems]);

  const visibleCategories = useMemo(() => categoryData.filter((c) => !hiddenCategories.has(c.name)), [categoryData, hiddenCategories]);

  // Filling breakdown: Veg, Paneer, Cheese Corn (Platter split into 2 each per 6)
  const fillingData = useMemo(() => {
    const stats: Record<string, { quantity: number; revenue: number }> = {
      Veg: { quantity: 0, revenue: 0 },
      Paneer: { quantity: 0, revenue: 0 },
      'Cheese Corn': { quantity: 0, revenue: 0 },
    };
    for (const item of allItemsBreakdown) {
      if (item.filling === 'Platter') {
        const split = item.totalQuantity / 3;
        stats.Veg.quantity += split;
        stats.Paneer.quantity += split;
        stats['Cheese Corn'].quantity += split;
        // Revenue: split platter revenue proportionally? Or keep in platter?
        // Let's keep revenue per filling as their own item revenue
        // Platter revenue stays in platter (not shown in filling chart)
      } else if (stats[item.filling]) {
        stats[item.filling].quantity += item.totalQuantity;
        stats[item.filling].revenue += item.totalRevenue;
      }
    }
    return Object.entries(stats)
      .map(([name, stat]) => ({ name, totalQuantity: stat.quantity, totalRevenue: stat.revenue }))
      .filter((s) => s.totalQuantity > 0);
  }, [allItemsBreakdown]);

  const filteredOrders = useMemo(() => {
    if (!data?.orders) return [];
    if (filterPayment === 'all') return data.orders;
    return data.orders.filter((o: Order) => o.paymentMethod === filterPayment);
  }, [data, filterPayment]);

  const fillingBreakdown = useMemo(() => {
    if (!menuData?.items || !data?.orders) return [];
    const menuMap = new Map<string, MenuItem>((menuData.items as MenuItem[]).map((i) => [i.displayName, i]));
    const stats: Record<string, { quantity: number; orders: Set<number>; plates: number }> = {
      Veg: { quantity: 0, orders: new Set(), plates: 0 },
      Paneer: { quantity: 0, orders: new Set(), plates: 0 },
      'Cheese Corn': { quantity: 0, orders: new Set(), plates: 0 },
      Platter: { quantity: 0, orders: new Set(), plates: 0 },
    };
    for (const order of data.orders) {
      for (const item of order.items) {
        const menuItem = menuMap.get(item.itemName);
        if (!menuItem) continue;
        const filling = menuItem.filling;
        if (!stats[filling]) continue;
        stats[filling].quantity += item.quantity;
        stats[filling].orders.add(order.id);
        stats[filling].plates += item.quantity / 6;
      }
    }
    return Object.entries(stats).map(([filling, stat]) => ({
      filling,
      value: fillingView === 'quantities' ? stat.quantity : fillingView === 'orders' ? stat.orders.size : stat.plates,
    }));
  }, [data, menuData, fillingView]);

  const maxFillingValue = Math.max(...fillingBreakdown.map((i) => i.value), 1);

  const toggleItem = (itemName: string) => {
    vibrate(haptics.light);
    setHiddenItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemName)) next.delete(itemName);
      else next.add(itemName);
      return next;
    });
  };

  const toggleCategory = (cat: string) => {
    vibrate(haptics.light);
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const toggleSort = (field: 'name' | 'quantity' | 'revenue') => {
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
    if (!data || !filteredOrders.length) {
      setToast({ message: 'No data to export', type: 'error' });
      return;
    }
    exportDashboardToExcel({
      startDate,
      endDate,
      totalOrders: data.totalOrders,
      totalRevenue: data.totalRevenue,
      pendingAmount: data.pendingAmount,
      cashTotal: data.cashTotal,
      upiTotal: data.upiTotal,
      itemBreakdown: allItemsBreakdown,
      orders: data.orders || [],
      supplyOrders,
      supplyVerifications,
      fillingBreakdown,
      fillingView,
      staffLogs,
      supplyLogs,
    });
    setToast({ message: 'Excel exported!', type: 'success' });
  };

  // Payment chart data
  const paymentChartData = useMemo<ChartDatum[]>(() => {
    const items: ChartDatum[] = [];
    if (data?.cashTotal) items.push({ name: 'Cash', value: data.cashTotal, color: isDark ? '#7A9A7A' : '#6B8E6B' });
    if (data?.upiTotal) items.push({ name: 'UPI', value: data.upiTotal, color: isDark ? '#9A8AA8' : '#8B7FA8' });
    return items;
  }, [data, isDark]);

  // Item chart data (only visible items for pie chart)
  const itemChartData = useMemo<ChartDatum[]>(() => {
    return visibleItems.map((item, idx) => ({
      name: item.itemName,
      value: item.totalRevenue,
      quantity: item.totalQuantity,
      color: ITEM_CHART_COLORS[idx],
    }));
  }, [visibleItems]);

  // Item legend data (all items for legend toggle)
  const itemLegendData = useMemo<ChartDatum[]>(() => {
    return allItemsBreakdown.map((item, idx) => ({
      name: item.itemName,
      value: item.totalRevenue,
      quantity: item.totalQuantity,
      color: ITEM_CHART_COLORS[idx],
      hidden: hiddenItems.has(item.itemName),
    }));
  }, [allItemsBreakdown, hiddenItems]);

  // Category chart data (only visible categories for pie chart)
  const categoryChartData = useMemo<ChartDatum[]>(() => {
    return visibleCategories.map((cat) => ({
      name: cat.name,
      value: cat.totalRevenue,
      quantity: cat.totalQuantity,
      color: CATEGORY_COLORS[cat.name],
    }));
  }, [visibleCategories]);

  // Category legend data (all categories for legend toggle)
  const categoryLegendData = useMemo<ChartDatum[]>(() => {
    return categoryData.map((cat) => ({
      name: cat.name,
      value: cat.totalRevenue,
      quantity: cat.totalQuantity,
      color: CATEGORY_COLORS[cat.name],
      hidden: hiddenCategories.has(cat.name),
    }));
  }, [categoryData, hiddenCategories]);

  // Filling chart data
  const fillingChartData = useMemo<ChartDatum[]>(() => {
    return fillingData.map((f) => ({
      name: f.name,
      value: f.totalRevenue,
      quantity: f.totalQuantity,
      color: FILLING_COLORS[f.name],
    }));
  }, [fillingData]);

  const ChartLegend = ({ data, activeSlice, onClick, onHover }: {
    data: ChartDatum[];
    activeSlice: string | null;
    onClick: (name: string) => void;
    onHover: (name: string | null) => void;
  }) => (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 0.5,
      mt: 1,
      maxHeight: 100,
      overflowY: 'auto',
      pr: 0.5,
    }}>
      {data.map((d) => {
        const isActive = activeSlice === d.name;
        const isHidden = d.hidden;
        return (
          <MuiTooltip
            key={d.name}
            title={`${d.name} — Qty: ${d.quantity ?? 0}, Rev: ₹${d.value}`}
            arrow
            TransitionComponent={Fade}
            placement="top"
          >
            <Chip
              size="small"
              label={d.name}
              onClick={() => onClick(d.name)}
              onMouseEnter={() => onHover(d.name)}
              onMouseLeave={() => onHover(null)}
              sx={{
                opacity: isHidden ? 0.35 : 1,
                backgroundColor: isHidden ? 'transparent' : d.color,
                color: isHidden ? 'text.secondary' : '#fff',
                fontWeight: 600,
                fontSize: '0.6rem',
                cursor: 'pointer',
                height: 20,
                transition: 'all 0.2s ease',
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                '&:hover': {
                  backgroundColor: isHidden ? 'rgba(255,255,255,0.1)' : d.color,
                },
              }}
            />
          </MuiTooltip>
        );
      })}
    </Box>
  );

  const toggleChartType = (chartId: string) => {
    vibrate(haptics.light);
    setChartTypes((prev) => ({ ...prev, [chartId]: prev[chartId] === 'pie' ? 'donut' : 'pie' }));
  };

  const openChartModal = (chartId: string, title: string, data: ChartDatum[]) => {
    vibrate(haptics.light);
    setModalChart({ title, data, chartId, type: 'pie' });
  };

  const renderPieChart = (
    chartData: ChartDatum[],
    totalLabel: string,
    totalValue: number | string,
    onSliceEnter: (name: string | null) => void,
    chartId: string,
    isDonut: boolean,
  ) => (
    <Box sx={{ height: 280, width: '100%', position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={isDonut ? 70 : 0}
            outerRadius={isDonut ? 110 : 105}
            paddingAngle={isDonut ? 2 : 1}
            onMouseEnter={(_: unknown, idx: number) => onSliceEnter(chartData[idx]?.name || null)}
            onMouseLeave={() => onSliceEnter(null)}
            label={false}
            labelLine={false}
            stroke={isDark ? 'rgba(255,255,255,0.08)' : '#fff'}
            strokeWidth={2}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                opacity={activePieSlice && activePieSlice !== entry.name ? 0.4 : 1}
                style={{ transition: 'opacity 0.2s ease', cursor: 'pointer' }}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: any, name: any, props: any) => {
              const data = props.payload as ChartDatum;
              const total = chartData.reduce((sum, d) => sum + d.value, 0);
              const pct = total > 0 ? ((data.value / total) * 100).toFixed(1) : '0';
              return [
                `₹${Number(value).toLocaleString()}${data.quantity !== undefined ? ` | Qty: ${data.quantity}` : ''} (${pct}%)`,
                name,
              ];
            }}
            contentStyle={{
              backgroundColor: isDark ? '#1E1E26' : '#fff',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB'}`,
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {isDonut && (
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none',
        }}>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>
            {totalLabel}
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, color: 'text.primary', lineHeight: 1.2, mt: 0.25 }}>
            {totalValue}
          </Typography>
        </Box>
      )}
      {/* Expand + Toggle buttons */}
      <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 0.5 }}>
        <IconButton
          size="small"
          onClick={() => toggleChartType(chartId)}
          sx={{ color: 'text.secondary', p: 0.3, width: 24, height: 24 }}
        >
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 700 }}>
            {isDonut ? 'D' : 'P'}
          </Typography>
        </IconButton>
        <IconButton
          size="small"
          onClick={() => openChartModal(chartId, totalLabel, chartData)}
          sx={{ color: 'text.secondary', p: 0.3, width: 24, height: 24 }}
        >
          <Maximize2 size={12} />
        </IconButton>
      </Box>
    </Box>
  );

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
                    .filter((i: SupplyOrderItem) => i.category === 'momo_packet')
                    .reduce((sum: number, i: SupplyOrderItem) => sum + i.quantity * i.piecesPer, 0);
                  const ver = supplyVerifications.find((v) => v.orderDate === order.orderDate);
                  const status = ver ? (ver.conflictCount > 0 ? 'conflicted' : 'verified') : 'not verified';
                  const statusColor = status === 'verified' ? 'success' : status === 'conflicted' ? 'error' : 'warning';
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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.primary' }}>
                            {formatDateLabel(order.orderDate)}
                          </Typography>
                          <Chip
                            size="small"
                            label={status}
                            color={statusColor}
                            sx={{
                              height: 18,
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              textTransform: 'capitalize',
                            }}
                          />
                        </Box>
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

            {/* Charts grid: 2x2 */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 2 }}>
              {/* Payment Split */}
              <Paper sx={{
                borderRadius: 2,
                p: 2,
                overflow: 'hidden',
                background: isDark ? 'linear-gradient(135deg, #1E1E26 0%, #252530 100%)' : undefined,
                border: isDark ? '1px solid rgba(255,255,255,0.06)' : undefined,
                display: 'flex',
                flexDirection: 'column',
              }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 1 }}>
                  Payment Split
                </Typography>
                {renderPieChart(
                  paymentChartData,
                  'Paid',
                  `₹${(data.cashTotal ?? 0) + (data.upiTotal ?? 0)}`,
                  setActivePieSlice,
                  'payment',
                  chartTypes.payment === 'donut',
                )}
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1 }}>
                  {paymentChartData.map((d) => (
                    <Box key={d.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: d.color }} />
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.primary' }}>
                        {d.name}: ₹{d.value.toLocaleString()}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>

              {/* Item Breakdown */}
              <Paper sx={{
                borderRadius: 2,
                p: 2,
                overflow: 'hidden',
                background: isDark ? 'linear-gradient(135deg, #1E1E26 0%, #252530 100%)' : undefined,
                border: isDark ? '1px solid rgba(255,255,255,0.06)' : undefined,
                display: 'flex',
                flexDirection: 'column',
              }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 1 }}>
                  Item Breakdown
                </Typography>
                {renderPieChart(
                  itemChartData,
                  'Items',
                  visibleItems.length,
                  setActivePieSlice,
                  'item',
                  chartTypes.item === 'donut',
                )}
                <ChartLegend
                  data={itemLegendData}
                  activeSlice={activePieSlice}
                  onClick={toggleItem}
                  onHover={setActivePieSlice}
                />
              </Paper>

              {/* Category Breakdown */}
              <Paper sx={{
                borderRadius: 2,
                p: 2,
                overflow: 'hidden',
                background: isDark ? 'linear-gradient(135deg, #1E1E26 0%, #252530 100%)' : undefined,
                border: isDark ? '1px solid rgba(255,255,255,0.06)' : undefined,
                display: 'flex',
                flexDirection: 'column',
              }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 1 }}>
                  Category Breakdown
                </Typography>
                {renderPieChart(
                  categoryChartData,
                  'Categories',
                  visibleCategories.length,
                  setActivePieSlice,
                  'category',
                  chartTypes.category === 'donut',
                )}
                <ChartLegend
                  data={categoryLegendData}
                  activeSlice={activePieSlice}
                  onClick={toggleCategory}
                  onHover={setActivePieSlice}
                />
              </Paper>

              {/* Filling Breakdown */}
              <Paper sx={{
                borderRadius: 2,
                p: 2,
                overflow: 'hidden',
                background: isDark ? 'linear-gradient(135deg, #1E1E26 0%, #252530 100%)' : undefined,
                border: isDark ? '1px solid rgba(255,255,255,0.06)' : undefined,
                display: 'flex',
                flexDirection: 'column',
              }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 1 }}>
                  Filling Breakdown
                </Typography>
                <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mb: 1, fontWeight: 500 }}>
                  Platter split: 2 Veg + 2 Paneer + 2 Cheese Corn per plate
                </Typography>
                {renderPieChart(
                  fillingChartData,
                  'Fillings',
                  fillingChartData.length,
                  setActivePieSlice,
                  'filling',
                  chartTypes.filling === 'donut',
                )}
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1 }}>
                  {fillingChartData.map((d) => (
                    <Box key={d.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: d.color }} />
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.primary' }}>
                        {d.name}: {d.quantity?.toFixed(0)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Box>

            {/* Filling Bar Breakdown */}
            <Paper sx={{
              borderRadius: 2,
              p: 2,
              mb: 2,
              overflow: 'hidden',
              background: isDark ? 'linear-gradient(135deg, #1E1E26 0%, #252530 100%)' : undefined,
              border: isDark ? '1px solid rgba(255,255,255,0.06)' : undefined,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary' }}>
                  Filling Performance
                </Typography>
                <ToggleButtonGroup
                  value={fillingView}
                  exclusive
                  onChange={(_e, val) => val && setFillingView(val)}
                  size="small"
                  sx={{ '& .MuiToggleButtonGroup-grouped': { borderRadius: 2, border: 0, mx: 0.25 } }}
                >
                  <ToggleButton value="plates">Plates</ToggleButton>
                  <ToggleButton value="orders">Orders</ToggleButton>
                  <ToggleButton value="quantities">Quantities</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {fillingBreakdown.map((item) => (
                  <Box key={item.filling}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {item.filling}
                      </Typography>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 700 }}>
                        {fillingView === 'plates' ? item.value.toFixed(1) : item.value}
                      </Typography>
                    </Box>
                    <Box sx={{ width: '100%', height: 8, borderRadius: 4, backgroundColor: 'divider' }}>
                      <Box sx={{
                        width: `${(item.value / maxFillingValue) * 100}%`,
                        height: '100%',
                        borderRadius: 4,
                        backgroundColor: item.filling === 'Veg' ? '#16A34A' : item.filling === 'Paneer' ? '#F59E0B' : item.filling === 'Cheese Corn' ? '#2563EB' : '#9CA3AF',
                        transition: 'width 0.5s ease',
                      }} />
                    </Box>
                  </Box>
                ))}
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
                  <IconButton size="small" onClick={() => toggleSort('name')} sx={{ color: sortBy === 'name' ? 'primary.main' : 'text.secondary' }}>
                    <List size={16} />
                  </IconButton>
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
                  {sortedAllItems.map((item, idx: number) => (
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
                  {sortedAllItems.length === 0 && (
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
                        {order.items.map((i) => `${formatQuantity(i.quantity)} ${i.itemName}${i.isHalf ? ' (½)' : ''}`).join(', ')}
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

      {/* Chart Modal */}
      <Dialog
        open={!!modalChart}
        onClose={() => setModalChart(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, overflow: 'hidden' } }}
      >
        {modalChart && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, pb: 1 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: 'text.primary' }}>
                {modalChart.title}
              </Typography>
              <IconButton size="small" onClick={() => setModalChart(null)} sx={{ color: 'text.secondary' }}>
                <X size={18} />
              </IconButton>
            </DialogTitle>
            <DialogContent sx={{ p: 2, pt: 0, overflow: 'hidden' }}>
              <Box sx={{ mb: 1.5, display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                {(['pie', 'bar'] as const).map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    size="small"
                    onClick={() => setModalChart((prev) => prev ? { ...prev, type: t } : null)}
                    color={modalChart.type === t ? 'primary' : 'default'}
                    variant={modalChart.type === t ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 600, textTransform: 'capitalize', fontSize: '0.75rem' }}
                  />
                ))}
              </Box>
              <Box sx={{ height: 450, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  {modalChart.type === 'pie' && (
                    <PieChart>
                      <Pie
                        data={modalChart.data}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="45%"
                        innerRadius={90}
                        outerRadius={160}
                        paddingAngle={2}
                         label={false}
                         labelLine={false}
                        stroke={isDark ? 'rgba(255,255,255,0.08)' : '#fff'}
                        strokeWidth={2}
                      >
                        {modalChart.data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                       <Tooltip
                         formatter={(value: any, name: any, props: any) => {
                           const data = props.payload as ChartDatum;
                           const total = modalChart.data.reduce((sum, d) => sum + d.value, 0);
                           const pct = total > 0 ? ((data.value / total) * 100).toFixed(1) : '0';
                           return [
                             `₹${Number(value).toLocaleString()}${data.quantity !== undefined ? ` | Qty: ${data.quantity}` : ''} (${pct}%)`,
                             name,
                           ];
                         }}
                         contentStyle={{
                           backgroundColor: isDark ? '#1E1E26' : '#fff',
                           border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB'}`,
                           borderRadius: '8px',
                           fontSize: '12px',
                           fontWeight: 600,
                         }}
                       />
                       <Legend 
                         verticalAlign="bottom" 
                         height={36}
                         wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                       />
                    </PieChart>
                  )}
                  {modalChart.type === 'bar' && (
                    <BarChart data={modalChart.data} margin={{ top: 10, right: 10, left: 10, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB'} />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 11, fill: isDark ? '#9CA3AF' : '#6B7280' }} 
                        angle={-45} 
                        textAnchor="end" 
                        height={80}
                        interval={0}
                      />
                      <YAxis tick={{ fontSize: 11, fill: isDark ? '#9CA3AF' : '#6B7280' }} />
                      <Tooltip
                        formatter={(value: any, name: any) => [`₹${Number(value).toLocaleString()}`, name]}
                        contentStyle={{
                          backgroundColor: isDark ? '#1E1E26' : '#fff',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB'}`,
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {modalChart.data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2, pt: 0 }}>
              <Button onClick={() => setModalChart(null)} sx={{ textTransform: 'none', fontWeight: 600 }}>
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
