import * as XLSX from 'xlsx';
import type { SupplyOrder, SupplyOrderLog, StaffOperationLog, SupplyVerification, SupplyItem } from '../types';

interface SupplyExportData {
  date: string;
  existingOrder: SupplyOrder | undefined;
  logs: SupplyOrderLog[];
  staffLogs: StaffOperationLog[];
  verification: SupplyVerification | undefined;
  items: SupplyItem[];
}

export function exportSupplyToExcel(data: SupplyExportData) {
  const wb = XLSX.utils.book_new();

  // 1. Summary Sheet
  const summaryRows = [
    ['Supply Order Report', ''],
    ['Date', data.date],
    ['', ''],
    ['Metric', 'Value'],
    ['Order ID', data.existingOrder?.id || 'N/A'],
    ['Total Cost', `₹${data.existingOrder?.totalCost || 0}`],
    ['Items Count', data.existingOrder?.items?.length || 0],
    ['', ''],
    ['Verification Status', data.verification?.isFullyVerified ? 'Verified' : 'Not Verified'],
    ['Conflict Count', data.verification?.conflictCount || 0],
    ['Items Verified', data.verification?.items?.filter((i) => i.actualQty !== null).length || 0],
    ['Total Items', data.verification?.items?.length || 0],
    ['', ''],
    ['Supply Logs Count', data.logs.length],
    ['Staff Logs Count', data.staffLogs.length],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // 2. Order Items Sheet
  if (data.existingOrder?.items && data.existingOrder.items.length > 0) {
    const orderHeaders = ['Item', 'Category', 'Quantity', 'Unit Price', 'Line Total', 'Pieces Per'];
    const orderRows = data.existingOrder.items.map((i) => [
      i.displayName,
      i.category,
      i.quantity,
      i.unitPrice,
      i.lineTotal,
      i.piecesPer,
    ]);
    const wsOrder = XLSX.utils.aoa_to_sheet([orderHeaders, ...orderRows]);
    wsOrder['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsOrder, 'Order Items');
  }

  // 3. Verification Items Sheet
  if (data.verification?.items && data.verification.items.length > 0) {
    const verHeaders = ['Item', 'Category', 'Expected Qty', 'Actual Qty', 'Conflict', 'Unit Price'];
    const verRows = data.verification.items.map((i) => [
      i.displayName,
      i.category,
      i.expectedQty,
      i.actualQty ?? 'N/A',
      i.hasConflict ? 'Yes' : 'No',
      i.unitPrice,
    ]);
    const wsVer = XLSX.utils.aoa_to_sheet([verHeaders, ...verRows]);
    wsVer['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsVer, 'Verification Items');
  }

  // 4. Supply Change Logs Sheet
  const supplyLogHeaders = ['ID', 'Date', 'Action', 'Staff', 'Item Summary', 'Created At'];
  const supplyLogRows = data.logs.map((l) => [
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

  // 5. Staff Logs Sheet
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

  // 6. All Supply Items (Master List)
  const itemsHeaders = ['ID', 'Name', 'Category', 'Unit Price', 'Pieces Per', 'Display Name'];
  const itemsRows = data.items.map((i) => [
    i.id,
    i.name,
    i.category,
    i.unitPrice,
    i.piecesPer,
    i.displayName,
  ]);
  const wsItems = XLSX.utils.aoa_to_sheet([itemsHeaders, ...itemsRows]);
  wsItems['!cols'] = [{ wch: 8 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsItems, 'Master Items');

  // Download
  const fileName = `supply_order_${data.date}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
