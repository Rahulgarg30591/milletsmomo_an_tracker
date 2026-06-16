import { useState } from 'react';
import { Box, Button, TextField, Typography, Table, TableBody, TableCell, TableHead, TableRow, Paper, Chip } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { getAdminSummary } from '../api/adminApi';
import { getToday, formatDateLabel } from '../utils/dateUtils';
import StatChip from '../components/StatChip';
import type { Order } from '../types';

const statusColors = {
  dine: { bg: '#EFF6FF', fg: '#1D4ED8' },
  pack: { bg: '#FEF3C7', fg: '#D97706' },
  cash: { bg: '#D1FAE5', fg: '#065F46' },
  upi: { bg: '#EDE9FE', fg: '#5B21B6' },
  pending: { bg: '#FEE2E2', fg: '#DC2626' },
};

export default function AdminDashboardPage() {
  const [date, setDate] = useState(getToday());

  const { data, isLoading } = useQuery({
    queryKey: ['adminSummary', date],
    queryFn: () => getAdminSummary(date),
  });

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#F0F4F1', p: 2 }}>
      <Box sx={{ maxWidth: 960, mx: 'auto' }}>
        <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', mb: 3, color: '#111827', letterSpacing: '-0.3px' }}>
          Admin Dashboard
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
          <TextField
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
                backgroundColor: '#FFFFFF',
              },
            }}
          />
          <Button
            variant="contained"
            onClick={() => setDate(getToday())}
            sx={{
              borderRadius: 3,
              py: 1,
              textTransform: 'none',
              fontWeight: 600,
              backgroundColor: '#1B6B3A',
            }}
          >
            Today
          </Button>
        </Box>

        {isLoading && <Typography sx={{ color: '#6B7280' }}>Loading...</Typography>}

        {data && (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' },
                gap: 1.5,
                mb: 3,
              }}
            >
              <StatChip label="Total Orders" value={data.totalOrders} />
              <StatChip label="Total Revenue" value={`₹${data.totalRevenue}`} />
              <StatChip label="Pending" value={`₹${data.pendingAmount}`} color="#DC2626" />
              <StatChip label="Cash / UPI" value={`₹${data.cashTotal} / ₹${data.upiTotal}`} />
            </Box>

            <Paper sx={{ borderRadius: 4, overflow: 'hidden', mb: 3, boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' }}>
              <Box sx={{ p: 2, borderBottom: '1px solid #F3F4F6' }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>
                  Item Breakdown
                </Typography>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#F9FAFB' }}>
                    <TableCell sx={{ fontWeight: 700, color: '#374151', fontSize: '0.8rem' }}>Item</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#374151', fontSize: '0.8rem' }}>Qty</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#374151', fontSize: '0.8rem' }}>Revenue</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.itemBreakdown?.map((item: any, idx: number) => (
                    <TableRow key={idx} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                      <TableCell sx={{ fontSize: '0.85rem', color: '#111827' }}>{item.itemName}</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#1B6B3A' }}>
                        {item.totalQuantity}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#1B6B3A' }}>
                        ₹{item.totalRevenue}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!data.itemBreakdown || data.itemBreakdown.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} sx={{ color: '#9CA3AF', textAlign: 'center', py: 3 }}>
                        No orders for this date
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>

            <Paper sx={{ borderRadius: 4, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' }}>
              <Box sx={{ p: 2, borderBottom: '1px solid #F3F4F6' }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>
                  Orders for {formatDateLabel(date)}
                </Typography>
              </Box>
              <Box sx={{ p: 2 }}>
                {data.orders?.map((order: Order) => (
                  <Box
                    key={order.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      py: 1.5,
                      borderBottom: '1px solid #F3F4F6',
                      '&:last-child': { borderBottom: 0 },
                    }}
                  >
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#111827' }}>
                          {order.timeLabel}
                        </Typography>
                        <Chip
                          size="small"
                          label={order.orderType === 'dine' ? 'Dine' : 'Pack'}
                          sx={{
                            height: 20,
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            backgroundColor: statusColors[order.orderType].bg,
                            color: statusColors[order.orderType].fg,
                          }}
                        />
                        <Chip
                          size="small"
                          label={order.paymentMethod}
                          sx={{
                            height: 20,
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            backgroundColor: statusColors[order.paymentMethod].bg,
                            color: statusColors[order.paymentMethod].fg,
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
                              backgroundColor: '#F3F4F6',
                              color: '#6B7280',
                            }}
                          />
                        )}
                      </Box>
                      <Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>
                        {order.items.map((i) => `${i.quantity}x ${i.itemName}${i.isHalf ? ' (½)' : ''}`).join(', ')}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: '#1B6B3A' }}>
                      ₹{order.totalAmount}
                    </Typography>
                  </Box>
                ))}
                {(!data.orders || data.orders.length === 0) && (
                  <Typography sx={{ color: '#9CA3AF', textAlign: 'center', py: 3 }}>
                    No orders for this date
                  </Typography>
                )}
              </Box>
            </Paper>
          </>
        )}
      </Box>
    </Box>
  );
}
