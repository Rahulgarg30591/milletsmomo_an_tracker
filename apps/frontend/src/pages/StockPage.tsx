import { useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Typography, Paper, useTheme, Chip } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Package, Layers, PieChart } from 'lucide-react';
import { getSupplyVerification } from '../api/supplyVerificationApi';
import { getClosingStock } from '../api/closingStockApi';
import { getOrders } from '../api/ordersApi';
import { getSupplyItems } from '../api/supplyApi';
import { getMenu } from '../api/menuApi';
import { getToday, addDays } from '../utils/dateUtils';
import { trackPageView } from '../utils/tracking';
import type { SupplyVerification, ClosingStock } from '../types';

interface StockItem {
  supplyItemId: number;
  displayName: string;
  category: string;
  piecesPer: number;
  // Opening = yesterday closing + verified supply
  openingPackets: number;
  openingPieces: number;
  openingTotalPieces: number;
  // Consumed = orders
  consumedPieces: number;
  // Remaining = opening - consumed
  remainingPackets: number;
  remainingPieces: number;
  remainingTotalPieces: number;
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

  const { data: supplyItems } = useQuery({
    queryKey: ['supplyItems'],
    queryFn: getSupplyItems,
  });

  const { data: menuData } = useQuery({
    queryKey: ['menu'],
    queryFn: getMenu,
  });

  useEffect(() => {
    trackPageView('stock', `Viewed live stock for ${targetDate}`);
  }, [targetDate]);

  const stockItems = useMemo<StockItem[]>(() => {
    if (!supplyItems || !supplyVerification) return [];

    const menuItems = (menuData?.items || []) as Array<{ id: number; filling: string; displayName: string }>;
    const menuMap = new Map(menuItems.map((mi) => [mi.id, mi]));

    const items: StockItem[] = [];

    for (const si of supplyItems) {
      if (si.category !== 'momo_packet') continue;

      const piecesPer = si.piecesPer || 24;

      // Extract filling from supply item name (e.g., "Veg Momo (24 Pcs)" -> "Veg")
      const siFilling = si.displayName.split(' ')[0];
      // Handle "Cheese Corn" which is two words
      const fullFilling = si.displayName.includes('Cheese Corn') ? 'Cheese Corn' : siFilling;

      // Yesterday closing stock
      const yestItem = yesterdayClosing?.items.find((i) => i.supplyItemId === si.id);
      const yestPackets = yestItem?.packetsLeft || 0;
      const yestPieces = yestItem?.piecesLeft || 0;
      const yestTotalPieces = yestPackets * piecesPer + yestPieces;

      // Today verified supply
      const verItem = supplyVerification.items.find((i) => i.supplyItemId === si.id);
      const verQty = verItem?.actualQty ?? 0;
      const verTotalPieces = verQty * piecesPer;

      // Opening stock = yesterday closing + verified supply
      const openingTotalPieces = yestTotalPieces + verTotalPieces;
      const openingPackets = Math.floor(openingTotalPieces / piecesPer);
      const openingPieces = openingTotalPieces % piecesPer;

      // Consumed = orders for this date
      const orders = ordersData?.orders || [];
      let consumedPieces = 0;
      for (const order of orders) {
        for (const orderItem of order.items) {
          const menuItem = menuMap.get(orderItem.menuItemId);
          if (!menuItem) continue;

          const itemFilling = menuItem.filling;
          const quantity = orderItem.quantity;

          if (itemFilling === fullFilling) {
            // Direct match: Veg -> Veg, Paneer -> Paneer, etc.
            consumedPieces += quantity;
          } else if (itemFilling === 'Platter') {
            // Platter: split into 2 Veg + 2 Paneer + 2 Cheese Corn per 6
            // So per momo quantity: each type gets quantity / 3
            const perType = Math.round(quantity / 3);
            if (fullFilling === 'Veg' || fullFilling === 'Paneer' || fullFilling === 'Cheese Corn') {
              consumedPieces += perType;
            }
          }
        }
      }

      // Remaining = opening - consumed
      const remainingTotalPieces = Math.max(0, openingTotalPieces - consumedPieces);
      const remainingPackets = Math.floor(remainingTotalPieces / piecesPer);
      const remainingPieces = remainingTotalPieces % piecesPer;

      items.push({
        supplyItemId: si.id,
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
      });
    }

    return items;
  }, [supplyItems, supplyVerification, yesterdayClosing, ordersData, menuData]);

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
          <Paper sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider', textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <Package size={16} color="#1B6B3A" />
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Packets
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', color: 'text.primary' }}>
              {totalRemainingPackets}
            </Typography>
          </Paper>
          <Paper sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider', textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <Layers size={16} color="#D97706" />
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Loose
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', color: 'text.primary' }}>
              {totalRemainingPieces}
            </Typography>
          </Paper>
          <Paper sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider', textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <PieChart size={16} color="#7C3AED" />
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total Momos
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', color: 'text.primary' }}>
              {totalRemainingMomos}
            </Typography>
          </Paper>
        </Box>

        {/* Filling Breakdown Summary */}
        {stockItems.length > 0 && (
          <Paper sx={{ borderRadius: 2, overflow: 'hidden', border: 1, borderColor: 'divider', mb: 2 }}>
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Remaining by Filling
              </Typography>
            </Box>
            <Box sx={{ p: 1.5 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
                {stockItems.map((item) => {
                  const filling = item.displayName.includes('Cheese Corn') ? 'Cheese Corn' : item.displayName.split(' ')[0];
                  return (
                    <Box key={item.supplyItemId} sx={{ textAlign: 'center', p: 1, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                      <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>
                        {filling}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#1B6B3A' }}>
                          {item.remainingPackets} Packets
                        </Typography>
                        {item.remainingPieces > 0 && (
                          <Typography sx={{ fontSize: '0.75rem', color: '#1B6B3A', fontWeight: 600 }}>
                            + {item.remainingPieces} Loose Momos
                          </Typography>
                        )}
                        <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', fontWeight: 500, mt: 0.25 }}>
                          {item.remainingTotalPieces} Total Momos
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Paper>
        )}

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
                Verify supply order first to see stock
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
                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'text.primary' }}>
                  {item.displayName.replace(/\s*\(\d+\s*Pcs\)/i, '')}
                </Typography>
                <Chip
                  size="small"
                  label={`${item.piecesPer} pcs/pkt`}
                  sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }}
                />
              </Box>

              {/* Progress bar */}
              <Box sx={{ width: '100%', height: 6, borderRadius: 3, backgroundColor: 'divider', mb: 1 }}>
                <Box
                  sx={{
                    width: `${item.openingTotalPieces > 0 ? (item.remainingTotalPieces / item.openingTotalPieces) * 100 : 0}%`,
                    height: '100%',
                    borderRadius: 3,
                    backgroundColor: item.remainingTotalPieces > item.openingTotalPieces * 0.3 ? '#1B6B3A' : '#DC2626',
                    transition: 'width 0.5s ease',
                  }}
                />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                {/* Opening */}
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.25 }}>
                    Opening
                  </Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.primary' }}>
                    {item.openingPackets} pkt
                  </Typography>
                  {item.openingPieces > 0 && (
                    <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', fontWeight: 500 }}>
                      + {item.openingPieces} pcs
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', fontWeight: 600, mt: 0.25 }}>
                    {item.openingTotalPieces} total
                  </Typography>
                </Box>

                {/* Consumed */}
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.25 }}>
                    Consumed
                  </Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#DC2626' }}>
                    {item.consumedPieces} pcs
                  </Typography>
                  <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', fontWeight: 600, mt: 0.25 }}>
                    ~{Math.floor(item.consumedPieces / item.piecesPer)} pkt
                  </Typography>
                </Box>

                {/* Remaining */}
                <Box sx={{ textAlign: 'center', p: 0.5, borderRadius: 1, backgroundColor: isDark ? 'rgba(27,107,58,0.08)' : '#F0FDF4' }}>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#1B6B3A', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.25 }}>
                    Remaining
                  </Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: '#1B6B3A' }}>
                    {item.remainingPackets} pkt
                  </Typography>
                  {item.remainingPieces > 0 && (
                    <Typography sx={{ fontSize: '0.65rem', color: '#1B6B3A', fontWeight: 500 }}>
                      + {item.remainingPieces} pcs
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: '0.6rem', color: '#1B6B3A', fontWeight: 700, mt: 0.25 }}>
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
            • Opening = Yesterday's closing stock + Today's verified supply
            <br />
            • Consumed = Total momos from all completed orders today
            <br />
            • Remaining = Opening - Consumed
            <br />
            • 1 Packet = 24 Momos (displayed in packets + loose pieces)
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
