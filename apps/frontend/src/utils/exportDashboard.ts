import * as XLSX from 'xlsx';
import type { Order, SupplyOrder, SupplyOrderItem, StaffOperationLog, SupplyOrderLog } from '../types';

interface ExportData {
  startDate: string;
  endDate: string;
  totalOrders: number;
  totalRevenue: number;
  pendingAmount: number;
  cashTotal: number;
  upiTotal: number;
  itemBreakdown: { itemName: string; totalQuantity: number; totalRevenue: number; preparation: string; filling: string }[];
  orders: Order[];
  supplyOrders: SupplyOrder[];
  supplyVerifications: { orderDate: string; isFullyVerified: boolean; conflictCount: number }[];
  fillingBreakdown: { filling: string; value: number }[];
  fillingView: 'plates' | 'orders' | 'quantities';
  staffLogs: StaffOperationLog[];
  supplyLogs: SupplyOrderLog[];
}

function formatOrderItems(items: Order['items']) {
  return items.map((i) => `${i.quantity}x ${i.itemName}${i.isHalf ? ' (½)' : ''}`).join(', ');
}

function formatSupplyItems(items: SupplyOrderItem[]) {
  return items.map((i) => `${i.quantity}x ${i.displayName}`).join(', ');
}

export function exportDashboardToExcel(data: ExportData) {
  const wb = XLSX.utils.book_new();

  // 1. Summary Sheet
  const summaryRows = [
    ['Dashboard Report', ''],
    ['Date Range', `${data.startDate} to ${data.endDate}`],
    ['', ''],
    ['Metric', 'Value'],
    ['Total Orders', data.totalOrders],
    ['Total Revenue', `₹${data.totalRevenue}`],
    ['Pending Amount', `₹${data.pendingAmount}`],
    ['Cash Total', `₹${data.cashTotal}`],
    ['UPI Total', `₹${data.upiTotal}`],
    ['Total Paid', `₹${data.cashTotal + data.upiTotal}`],
    ['', ''],
    ['Payment Split', ''],
    ['Method', 'Amount'],
    ['Cash', `₹${data.cashTotal}`],
    ['UPI', `₹${data.upiTotal}`],
    ['Pending', `₹${data.pendingAmount}`],
    ['', ''],
    ['Supply Orders', ''],
    ['Total Supply Orders', data.supplyOrders.length],
    ['Total Supply Cost', `₹${data.supplyOrders.reduce((sum, o) => sum + o.totalCost, 0)}`],
    ['Verified Orders', data.supplyVerifications.filter((v) => v.isFullyVerified).length],
    ['Conflicted Orders', data.supplyVerifications.filter((v) => v.conflictCount > 0).length],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // 2. Orders Sheet
  const ordersHeaders = ['Time', 'Date', 'Type', 'Payment', 'Cash', 'UPI', 'Total', 'Status', 'Items', 'Item Count'];
  const ordersRows = data.orders.map((o) => [
    o.timeLabel,
    o.orderDate,
    o.orderType === 'dine' ? 'Dine In' : 'Pack',
    o.paymentMethod,
    o.cashAmount,
    o.upiAmount,
    o.totalAmount,
    o.isCompleted ? 'Completed' : 'Pending',
    formatOrderItems(o.items),
    o.items.length,
  ]);
  const wsOrders = XLSX.utils.aoa_to_sheet([ordersHeaders, ...ordersRows]);
  wsOrders['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
    { wch: 60 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsOrders, 'Orders');

  // 3. Items Sheet
  const itemsHeaders = ['Item', 'Preparation', 'Filling', 'Quantity', 'Revenue', 'Avg Price'];
  const itemsRows = data.itemBreakdown.map((i) => [
    i.itemName,
    i.preparation,
    i.filling,
    i.totalQuantity,
    i.totalRevenue,
    i.totalQuantity > 0 ? Math.round(i.totalRevenue / i.totalQuantity) : 0,
  ]);
  const wsItems = XLSX.utils.aoa_to_sheet([itemsHeaders, ...itemsRows]);
  wsItems['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsItems, 'Items');

  // 4. Filling Breakdown Sheet
  const fillingHeaders = ['Filling', 'Value', 'Unit'];
  const fillingRows = data.fillingBreakdown.map((f) => [
    f.filling,
    f.value,
    data.fillingView,
  ]);
  const wsFilling = XLSX.utils.aoa_to_sheet([fillingHeaders, ...fillingRows]);
  wsFilling['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsFilling, 'Fillings');

  // 5. Supply Orders Sheet
  const supplyHeaders = ['Date', 'Items', 'Total Cost', 'Verification Status', 'Conflicts'];
  const supplyRows = data.supplyOrders.map((o) => {
    const ver = data.supplyVerifications.find((v) => v.orderDate === o.orderDate);
    return [
      o.orderDate,
      formatSupplyItems(o.items),
      o.totalCost,
      ver ? (ver.conflictCount > 0 ? 'Conflicted' : 'Verified') : 'Not Verified',
      ver ? ver.conflictCount : 0,
    ];
  });
  const wsSupply = XLSX.utils.aoa_to_sheet([supplyHeaders, ...supplyRows]);
  wsSupply['!cols'] = [{ wch: 12 }, { wch: 60 }, { wch: 12 }, { wch: 15 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsSupply, 'Supply Orders');

  // 6. Order Items Detail Sheet
  const detailHeaders = ['Order Time', 'Order Type', 'Item Name', 'Quantity', 'Half', 'Unit Price', 'Line Total'];
  const detailRows: (string | number | boolean)[][] = [];
  data.orders.forEach((o) => {
    o.items.forEach((item) => {
      detailRows.push([
        o.timeLabel,
        o.orderType === 'dine' ? 'Dine In' : 'Pack',
        item.itemName,
        item.quantity,
        item.isHalf ? 'Yes' : 'No',
        item.unitPrice,
        item.lineTotal,
      ]);
    });
  });
  const wsDetail = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
  wsDetail['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Order Items');

  // 7. Staff Logs Sheet
  const staffHeaders = ['ID', 'Date', 'Operation', 'Staff', 'Details', 'Created At'];
  const staffRows = data.staffLogs.map((l) => [
    l.id,
    l.orderDate,
    l.operationType,
    l.displayName,
    l.details,
    l.createdAt,
  ]);
  const wsStaff = XLSX.utils.aoa_to_sheet([staffHeaders, ...staffRows]);
  wsStaff['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 50 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsStaff, 'Staff Logs');

  // 8. Supply Logs Sheet
  const supplyLogHeaders = ['ID', 'Date', 'Action', 'Staff', 'Item Summary', 'Created At'];
  const supplyLogRows = data.supplyLogs.map((l) => [
    l.id,
    l.orderDate,
    l.action,
    l.displayName,
    l.itemSummary,
    l.createdAt,
  ]);
  const wsSupplyLogs = XLSX.utils.aoa_to_sheet([supplyLogHeaders, ...supplyLogRows]);
  wsSupplyLogs['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 60 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSupplyLogs, 'Supply Logs');

  // Download
  const fileName = `dashboard_${data.startDate}_${data.endDate}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
