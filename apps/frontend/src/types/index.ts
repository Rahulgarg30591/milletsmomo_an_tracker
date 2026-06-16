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
  paymentMethod: 'cash' | 'upi' | 'pending';
  isCompleted: boolean;
  totalAmount: number;
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
  totalOrders: number;
  totalRevenue: number;
  pendingAmount: number;
  cashTotal: number;
  upiTotal: number;
  itemBreakdown: { itemName: string; totalQuantity: number; totalRevenue: number }[];
  orders: Order[];
}
