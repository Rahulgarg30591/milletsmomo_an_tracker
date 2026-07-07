import { useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Typography, Paper, useTheme, Chip } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Package, Layers, PieChart } from 'lucide-react';
import { getSupplyVerification } from '../api/supplyVerificationApi';
import { getClosingStock } from '../api/closingStockApi';
import { getOrders } from '../api/ordersApi';
import { getMenu } from '../api/menuApi';
import { getToday, addDays } from '../utils/dateUtils';
import { trackPageView } from '../utils/tracking';
import type { SupplyVerification, ClosingStock } from '../types';

interface StockItem {
  supplyItemId: number;
  displayName: string;
  category: string;
  piecesPer: number;
  openingPackets: number;
  openingPieces: number;
  openingTotalPieces: number;
  consumedPieces: number;
  remainingPackets: number;
  remainingPieces: number;
  remainingTotalPieces: number;
  isVerified: boolean;
}

export default function StockPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const targetDate = date || getToday();
  const yesterday = addDays(targetDate, -1);

  const { data: supplyVerification } = useQuery<SupplyVerification>({
    queryKey: ['supplyVerification', targetDate],
    queryFn: () => getSupplyVerification(targetDate),
    enabled: !!targetDate,
  });

  const { data: yesterdayClosing } = useQuery<ClosingStock>({
    queryKey: ['closingStock', yesterday],
    queryFn: () => getClosingStock(yesterday),
    enabled: !!yesterday,
  });

  const { data: ordersData } = useQuery({
    queryKey: ['orders', targetDate],
    queryFn: () => getOrders(targetDate),
    enabled: !!targetDate,
  });

  const { data: menuData } = useQuery({
    queryKey: ['menu'],
    queryFn: getMenu,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  useEffect(() => {
    trackPageView('stock', `Viewed live stock for ${targetDate}`);
  }, [targetDate]);

  const stockItems = useMemo<StockItem[]>(() => {
    const menuItems = (menuData?.items || []) as Array<{ id: number; filling: string; displayName: string }>;
    const menuMap = new Map(menuItems.map((mi) => [mi.id, mi]));

    const itemMap = new Map<number, {
      supplyItemId: number;
      displayName: string;
      category: string;
      piecesPer: number;
      closingPackets: number;
      closingPieces: number;
      closingTotalPieces: number;
      supplyQty: number;
      supplyTotalPieces: number;
      isVerified: boolean;
    }>();

    for (const cItem of yesterdayClosing?.items || []) {
      if (cItem.category !== 'momo_packet') continue;
      const piecesPer = cItem.piecesPer || 24;
      itemMap.set(cItem.supplyItemId, {
        supplyItemId: cItem.supplyItemId,
        displayName: cItem.displayName,
        category: cItem.category,
        piecesPer,
        closingPackets: cItem.packetsLeft,
        closingPieces: cItem.piecesLeft,
        closingTotalPieces: cItem.packetsLeft * piecesPer + cItem.piecesLeft,
        supplyQty: 0,
        supplyTotalPieces: 0,
        isVerified: false,
      });
    }

    for (const vItem of supplyVerification?.items || []) {
      if (vItem.category !== 'momo_packet') continue;
      const piecesPer = vItem.piecesPer || 24;
      const supplyQty = vItem.actualQty ?? vItem.expectedQty;
      const supplyTotalPieces = supplyQty * piecesPer;
      const existing = itemMap.get(vItem.supplyItemId);
      if (existing) {
        existing.supplyQty = supplyQty;
        existing.supplyTotalPieces = supplyTotalPieces;
        existing.isVerified = vItem.actualQty !== null;
      } else {
        itemMap.set(vItem.supplyItemId, {
          supplyItemId: vItem.supplyItemId,
          displayName: vItem.displayName,
          category: vItem.category,
          piecesPer,
          closingPackets: 0,
          closingPieces: 0,
          closingTotalPieces: 0,
          supplyQty,
          supplyTotalPieces,
          isVerified: vItem.actualQty !== null,
        });
      }
    }

    const orders = ordersData?.orders || [];

    return [...itemMap.values()].map((si) => {
      const piecesPer = si.piecesPer;
      const fullFilling =
        /cheese\s*corn/i.test(si.displayName) ? 'Cheese Corn' :
        /paneer/i.test(si.displayName) ? 'Paneer' :
        /veg/i.test(si.displayName) ? 'Veg' : 'Unknown';

      const openingTotalPieces = si.closingTotalPieces + si.supplyTotalPieces;
      const openingPackets = Math.floor(openingTotalPieces / piecesPer);
      const openingPieces = openingTotalPieces % piecesPer;

      let consumedPieces = 0;
      for (const order of orders) {
        for (const orderItem of order.items) {
          const menuItem = menuMap.get(orderItem.menuItemId);
          if (!menuItem) continue;
          const itemFilling = menuItem.filling;
          const quantity = orderItem.quantity;

          if (itemFilling === fullFilling) {
            consumedPieces += quantity;
          } else if (itemFilling === 'Platter') {
            const perType = Math.round(quantity / 3);
            if (fullFilling === 'Veg' || fullFilling === 'Paneer' || fullFilling === 'Cheese Corn') {
              consumedPieces += perType;
            }
          }
        }
      }

      const remainingTotalPieces = Math.max(0, openingTotalPieces - consumedPieces);
      const remainingPackets = Math.floor(remainingTotalPieces / piecesPer);
      const remainingPieces = remainingTotalPieces % piecesPer;

      return {
        supplyItemId: si.supplyItemId,
        displayName: si.displayName,
        category: si.category,
        piecesPer,
        openingPackets,
        openingPieces,
        openingTotalPieces,
        consumedPieces,
        remainingPackets,
        remainingPieces,
        remainingTotalPieces,
        isVerified: si.isVerified,
      };
    });
  }, [supplyVerification, yesterdayClosing, ordersData, menuData]);

  const totalRemainingPackets = stockItems.reduce((sum, s) => sum + s.remainingPackets, 0);
  const totalRemainingPieces = stockItems.reduce((sum, s) => sum + s.remainingPieces, 0);
  const totalRemainingMomos = stockItems.reduce((sum, s) => sum + s.remainingTotalPieces, 0);

  return (
    <Box sx={{ minHeight: 'calc(100vh - 56px)', backgroundColor: 'background.default', p: { xs: 1, md: 2 }, pb: { xs: 8, md: 6 } }}>
      <Box sx={{ maxWidth: { xs: '100%', md: 900 }, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 1.5, md: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 1 } }}>
            <Button
              size="small"
              startIcon={<ArrowLeft size={16} />}
              onClick={() => navigate(`/day/${targetDate}`)}
              sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary', minWidth: 0, px: 1 }}
            >
              Back
            </Button>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: '1rem', md: '1.25rem' }, color: 'text.primary', letterSpacing: '-0.3px' }}>
              Live Stock
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.secondary' }}>
            {targetDate}
          </Typography>
        </Box>

        {/* Summary Cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, 1fr)', md: 'repeat(3, 1fr)' }, gap: { xs: 0.75, md: 1 }, mb: { xs: 1.5, md: 2 } }}>
          <Paper sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider', textAlign: 'center', backgroundColor: isDark ? 'rgba(27,107,58,0.1)' : 'transparent' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <Package size={16} color="#1B6B3A" />
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: isDark ? '#4ADE80' : 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Packets
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', color: isDark ? '#4ADE80' : '#1B6B3A' }}>
              {totalRemainingPackets}
            </Typography>
          </Paper>
          <Paper sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider', textAlign: 'center', backgroundColor: isDark ? 'rgba(217,119,6,0.1)' : 'transparent' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <Layers size={16} color="#D97706" />
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: isDark ? '#FBBF24' : 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Loose
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', color: isDark ? '#FBBF24' : '#D97706' }}>
              {totalRemainingPieces}
            </Typography>
          </Paper>
          <Paper sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider', textAlign: 'center', backgroundColor: isDark ? 'rgba(124,58,237,0.1)' : 'transparent' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <PieChart size={16} color="#7C3AED" />
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: isDark ? '#C4A8E8' : 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total Momos
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', color: isDark ? '#C4A8E8' : '#7C3AED' }}>
              {totalRemainingMomos}
            </Typography>
          </Paper>
        </Box>

        {/* Stock Details */}
        <Paper sx={{ borderRadius: 2, overflow: 'hidden', border: 1, borderColor: 'divider' }}>
          <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Stock Details
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', fontWeight: 500 }}>
              1 Packet = {stockItems[0]?.piecesPer || 24} Momos
            </Typography>
          </Box>

          {stockItems.length === 0 && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem', fontWeight: 600 }}>
                No stock data available
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem', mt: 0.5 }}>
                {supplyVerification?.items.length === 0
                  ? 'Place and verify a supply order first'
                  : 'Could not load stock data'}
              </Typography>
            </Box>
          )}

          {stockItems.map((item) => (
            <Box
              key={item.supplyItemId}
              sx={{
                p: { xs: 1.25, md: 1.5 },
                borderBottom: 1,
                borderColor: 'divider',
                '&:last-child': { borderBottom: 0 },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'text.primary' }}>
                    {item.displayName.replace(/\s*\(\d+\s*Pcs\)/i, '')}
                  </Typography>
                  {!item.isVerified && item.openingTotalPieces > 0 && (
                    <Chip
                      size="small"
                      label="Expected"
                      sx={{ height: 18, fontSize: '0.55rem', fontWeight: 700, bgcolor: isDark ? '#3D2E1A' : '#FEF3C7', color: isDark ? '#FBBF24' : '#92400E' }}
                    />
                  )}
                </Box>
                <Chip
                  size="small"
                  label={`${item.piecesPer} pcs/pkt`}
                  sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }}
                />
              </Box>

              {/* Progress bar */}
              <Box sx={{ width: '100%', height: 6, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB', mb: 1 }}>
                <Box
                  sx={{
                    width: `${item.openingTotalPieces > 0 ? (item.remainingTotalPieces / item.openingTotalPieces) * 100 : 0}%`,
                    height: '100%',
                    borderRadius: 3,
                    backgroundColor: item.remainingTotalPieces > item.openingTotalPieces * 0.3
                      ? (isDark ? '#4ADE80' : '#1B6B3A')
                      : (isDark ? '#F87171' : '#DC2626'),
                  }}
                />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                {/* Opening */}
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: isDark ? '#9CA3AF' : 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.25 }}>
                    Opening
                  </Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.primary' }}>
                    {item.openingPackets} pkt
                  </Typography>
                  {item.openingPieces > 0 && (
                    <Typography sx={{ fontSize: '0.65rem', color: isDark ? '#9CA3AF' : 'text.secondary', fontWeight: 500 }}>
                      + {item.openingPieces} pcs
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: '0.6rem', color: isDark ? '#9CA3AF' : 'text.secondary', fontWeight: 600, mt: 0.25 }}>
                    {item.openingTotalPieces} total
                  </Typography>
                </Box>

                {/* Consumed */}
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: isDark ? '#9CA3AF' : 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.25 }}>
                    Consumed
                  </Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: isDark ? '#F87171' : '#DC2626' }}>
                    {item.consumedPieces} pcs
                  </Typography>
                  <Typography sx={{ fontSize: '0.6rem', color: isDark ? '#9CA3AF' : 'text.secondary', fontWeight: 600, mt: 0.25 }}>
                    ~{Math.floor(item.consumedPieces / item.piecesPer)} pkt
                  </Typography>
                </Box>

                {/* Remaining */}
                <Box sx={{ textAlign: 'center', p: 0.5, borderRadius: 1, backgroundColor: isDark ? 'rgba(27,107,58,0.15)' : '#F0FDF4' }}>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: isDark ? '#4ADE80' : '#1B6B3A', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.25 }}>
                    Remaining
                  </Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: isDark ? '#4ADE80' : '#1B6B3A' }}>
                    {item.remainingPackets} pkt
                  </Typography>
                  {item.remainingPieces > 0 && (
                    <Typography sx={{ fontSize: '0.65rem', color: isDark ? '#4ADE80' : '#1B6B3A', fontWeight: 500 }}>
                      + {item.remainingPieces} pcs
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: '0.6rem', color: isDark ? '#4ADE80' : '#1B6B3A', fontWeight: 700, mt: 0.25 }}>
                    {item.remainingTotalPieces} total
                  </Typography>
                </Box>
              </Box>
            </Box>
          ))}
        </Paper>

        {/* Legend */}
        <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, border: '1px dashed', borderColor: 'divider' }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.secondary', mb: 0.5 }}>
            How stock is calculated:
          </Typography>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', lineHeight: 1.5 }}>
            • Opening = Yesterday's closing stock + Today's supply (verified or expected)
            <br />
            • Consumed = Total momos from all orders today
            <br />
            • Remaining = Opening - Consumed
            <br />
            • "Expected" = not yet verified, using ordered qty
            <br />
            • 1 Packet = 24 Momos (displayed in packets + loose pieces)
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
