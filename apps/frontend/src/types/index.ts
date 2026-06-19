export interface MenuItem {
  id: number;
  filling: string;
  preparation: string;
  displayName: string;
  fullPrice: number;
  halfPrice: number;
}

export interface OrderItem {
  menuItemId: number;
  itemName: string;
  quantity: number;
  isHalf: boolean;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: number;
  orderDate: string;
  timeLabel: string;
  orderType: 'dine' | 'pack';
  paymentMethod: 'cash' | 'upi' | 'split' | 'pending';
  isCompleted: boolean;
  totalAmount: number;
  cashAmount: number;
  upiAmount: number;
  items: OrderItem[];
}

export interface LoginRequest {
  role: 'staff' | 'admin';
  pin: string;
}

export interface LoginResponse {
  token: string;
  role: 'staff' | 'admin';
  displayName: string;
  expiresIn: number;
}

export interface AdminSummary {
  date: string;
  endDate: string | null;
  totalOrders: number;
  totalRevenue: number;
  pendingAmount: number;
  cashTotal: number;
  upiTotal: number;
  itemBreakdown: { itemName: string; totalQuantity: number; totalRevenue: number }[];
  orders: Order[];
}

export interface SupplyItem {
  id: number;
  name: string;
  category: 'momo_packet' | 'sauce' | 'dip';
  unitPrice: number;
  piecesPer: number;
  displayName: string;
}

export interface SupplyOrderItem {
  supplyItemId: number;
  name: string;
  displayName: string;
  category: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  piecesPer: number;
}

export interface SupplyOrder {
  id: number;
  orderDate: string;
  totalCost: number;
  createdBy: number;
  createdAt: string;
  items: SupplyOrderItem[];
}

export interface CreateSupplyOrderRequest {
  orderDate: string;
  items: { supplyItemId: number; quantity: number }[];
}

export interface SupplyOrderLog {
  id: number;
  orderDate: string;
  action: 'CREATE' | 'UPDATE';
  createdBy: number;
  createdAt: string;
  itemSummary: string;
  displayName: string;
}

export interface SupplyVerificationItem {
  supplyItemId: number;
  displayName: string;
  category: string;
  expectedQty: number;
  actualQty: number | null;
  hasConflict: boolean;
  unitPrice: number;
  piecesPer: number;
}

export interface SupplyVerification {
  orderDate: string;
  items: SupplyVerificationItem[];
  isFullyVerified: boolean;
  conflictCount: number;
}

export interface CreateSupplyVerificationRequest {
  orderDate: string;
  items: { supplyItemId: number; expectedQty: number; actualQty: number }[];
}

export interface ClosingStockItem {
  supplyItemId: number;
  displayName: string;
  category: string;
  piecesPer: number;
  packetsLeft: number;
  piecesLeft: number;
  totalPiecesLeft: number;
}

export interface ClosingStock {
  orderDate: string;
  items: ClosingStockItem[];
  isSubmitted: boolean;
}

export interface CreateClosingStockRequest {
  orderDate: string;
  items: { supplyItemId: number; packetsLeft: number; piecesLeft: number }[];
}

export interface StaffOperationLog {
  id: number;
  orderDate: string;
  operationType: 'verification' | 'closing_stock' | 'order_create';
  createdBy: number;
  createdAt: string;
  details: string;
  displayName: string;
}

export interface StaffLogsResponse {
  logs: StaffOperationLog[];
}
