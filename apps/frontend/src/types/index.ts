export interface MenuItem {
  id: number;
  filling: string;
  preparation: string;
  displayName: string;
  fullPrice: number;
  halfPrice: number;
  /** Sold by the unit at a flat price, with no plate/half concept. */
  isBeverage?: boolean;
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
  comment?: string | null;
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
}

export interface MinimumSaleValueFilling {
  filling: string;
  openingPieces: number;
  closingPieces: number;
  wastagePieces: number;
  consumedPieces: number;
  plates: number;
  basePrice: number;
  minValue: number;
}

export interface MinimumSaleValueResult {
  date: string;
  fillings: MinimumSaleValueFilling[];
  totalMinimumSaleValue: number;
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

export interface NoSupplyResponse {
  orderDate: string;
  noSupply: boolean;
  /** Set by POST when marking cancelled an existing supply order. */
  cancelledOrderId?: number | null;
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
  noSupply?: boolean;
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
  wastagePieces: number;
  hasConflict: boolean;
  conflictReason: string | null;
  totalPiecesLeft: number;
}

export interface ClosingStock {
  orderDate: string;
  items: ClosingStockItem[];
  isSubmitted: boolean;
}

export interface CreateClosingStockRequest {
  orderDate: string;
  items: { supplyItemId: number; packetsLeft: number; piecesLeft: number; wastagePieces: number; hasConflict: boolean; conflictReason: string | null }[];
}

export interface StaffOperationLog {
  id: number;
  orderDate: string;
  operationType: 'verification' | 'closing_stock' | 'order_create' | 'order_update' | 'order_complete' | 'order_delete' | 'supply_order' | 'payment_settlement' | 'expense_save' | 'cylinder_refill' | 'login';
  createdBy: number;
  createdAt: string;
  details: string;
  metadata: Record<string, any> | null;
  displayName: string;
}

export interface StaffLogsResponse {
  logs: StaffOperationLog[];
}

export interface ExpenseItem {
  id?: number;
  description: string;
  amount: number;
}

export interface DayExpenses {
  orderDate: string;
  items: ExpenseItem[];
  totalAmount: number;
}

export interface SaveExpensesRequest {
  orderDate: string;
  items: { description: string; amount: number }[];
}

export type CylinderBrand = 'HP' | 'BP' | 'INDANE';

export interface CylinderRefill {
  id: number;
  refillDate: string;
  brand: CylinderBrand;
  amount: number;
  /** Where the cylinder came from; null if not recorded. */
  source: string | null;
  createdBy: number;
  createdByName: string;
  createdAt: string;
  updatedByName: string | null;
  updatedAt: string | null;
}

export interface CylinderRefillInput {
  brand: CylinderBrand;
  amount: number;
  source: string | null;
}

export interface CylinderMonthReport {
  month: string;
  refills: CylinderRefill[];
  byBrand: { brand: CylinderBrand; count: number; totalAmount: number }[];
  bySource: { source: string | null; count: number; totalAmount: number }[];
  count: number;
  totalAmount: number;
}
