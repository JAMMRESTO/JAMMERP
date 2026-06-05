// ============================================================
// MULTI-TENANCY
// ============================================================
export type TenantStatus = 'pending' | 'approved' | 'active' | 'rejected' | 'suspended';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  is_active: boolean;
  status: TenantStatus;
  rejection_reason: string | null;
  approved_at: string | null;
  approved_by: string | null;
  owner_id: string | null;
  subscription_expires_at: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  allowed_modules: {
    pos: boolean;
    delivery: boolean;
    kitchen: boolean;
    inventory: boolean;
    reports: boolean;
    reservations: boolean;
    production: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  address: string;
  phone: string;
  timezone: string;
  is_active: boolean;
  cashier_auth_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SiteWithTenant extends Site {
  tenant: Pick<Tenant, 'id' | 'name' | 'slug' | 'plan'>;
}

// ============================================================
// ROLES & USERS
// ============================================================
export interface Role {
  id: string;
  tenant_id: string | null;
  name: string;
  label: string;
  permissions: Record<string, boolean>;
  color: string;
  created_at: string;
}

export interface User {
  id: string;
  tenant_id: string | null;
  site_id: string | null;
  name: string;
  pin: string;
  email: string;
  role_id: string | null;
  avatar_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserWithRole extends User {
  role: Role | null;
}

// ============================================================
// SETTINGS
// ============================================================
export interface Setting {
  id: string;
  site_id: string | null;
  key: string;
  value: unknown;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  site_id: string | null;
  token: string;
  ip_address: string;
  is_active: boolean;
  logged_in_at: string;
  logged_out_at: string | null;
}

// ============================================================
// CATEGORIES & PRODUCTS
// ============================================================
export interface Category {
  id: string;
  site_id: string | null;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  track_stock: boolean;
  created_at: string;
}

export interface ProductVariant {
  label: string;
}

export interface Product {
  id: string;
  site_id: string | null;
  category_id: string | null;
  name: string;
  product_code: string;
  description: string;
  price: number;
  cost_price: number;
  image_url: string;
  stock: number | null;
  track_stock: boolean;
  is_available: boolean;
  unit: string;
  low_stock_threshold: number;
  variants: ProductVariant[];
  created_at: string;
  updated_at: string;
}

export type StockMovementType = 'in' | 'out' | 'adjustment';

export interface StockMovement {
  id: string;
  site_id: string | null;
  product_id: string;
  movement_type: StockMovementType;
  quantity: number;
  stock_before: number;
  stock_after: number;
  reason: string;
  user_id: string | null;
  created_at: string;
}

export interface StockMovementWithProduct extends StockMovement {
  product: Pick<Product, 'id' | 'name' | 'unit'> | null;
}

export interface ProductWithCategory extends Product {
  category: Category | null;
}

// ============================================================
// SALES & PAYMENTS
// ============================================================
export type SaleType = 'dine_in' | 'takeaway' | 'delivery';
export type SaleStatus = 'open' | 'paid' | 'cancelled';
export type PaymentMethod = 'cash' | 'wave' | 'orange_money' | 'card';

export interface Sale {
  id: string;
  site_id: string | null;
  sale_number: number;
  sale_type: SaleType;
  status: SaleStatus;
  table_number: string;
  customer_name: string;
  notes: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  cashier_id: string | null;
  created_at: string;
  paid_at: string | null;
  cancelled_by: string | null;
  cancelled_by_name: string;
  cancelled_at: string | null;
  cancel_reason: string;
}

export interface SaleItem {
  id: string;
  site_id: string | null;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  variant_label: string;
  kitchen_note: string;
  created_at: string;
}

export interface Payment {
  id: string;
  site_id: string | null;
  sale_id: string;
  method: PaymentMethod;
  amount: number;
  reference: string;
  created_at: string;
}

// ============================================================
// TABLES
// ============================================================
export type TableStatus = 'free' | 'occupied' | 'reserved';
export type TableShape = 'rect' | 'round';

export interface RestaurantTable {
  id: string;
  site_id: string | null;
  name: string;
  capacity: number;
  status: TableStatus;
  shape: TableShape;
  pos_x: number;
  pos_y: number;
  active_order_id: string | null;
  reserved_for: string;
  reserved_at: string | null;
  notes: string;
  floor: number;
  is_active: boolean;
  created_at: string;
}

// ============================================================
// ORDERS
// ============================================================
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
export type OrderType = 'dine_in' | 'takeaway' | 'delivery';
export type OrderItemStatus = 'pending' | 'preparing' | 'ready' | 'served';

export interface Order {
  id: string;
  site_id: string | null;
  order_number: number;
  table_id: string | null;
  sale_id: string | null;
  delivery_id: string | null;
  order_type: OrderType;
  status: OrderStatus;
  customer_name: string;
  notes: string;
  total_amount: number;
  cashier_id: string | null;
  created_at: string;
  updated_at: string;
  served_at: string | null;
  cancelled_at: string | null;
}

export interface OrderItem {
  id: string;
  site_id: string | null;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  variant_label: string;
  kitchen_note: string;
  status: OrderItemStatus;
  created_at: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
  table: Pick<RestaurantTable, 'id' | 'name'> | null;
}

// ============================================================
// DRIVERS & DELIVERIES
// ============================================================
export type DriverStatus = 'available' | 'busy' | 'offline';
export type DeliveryStatus = 'pending' | 'assigned' | 'picked_up' | 'delivered' | 'cancelled';
export type DriverPaymentType = 'commission' | 'bonus' | 'deduction' | 'advance';
export type DriverPaymentStatus = 'pending' | 'paid';

export interface Driver {
  id: string;
  site_id: string | null;
  name: string;
  phone: string;
  photo_url: string;
  status: DriverStatus;
  commission_rate: number;
  total_deliveries: number;
  total_earnings: number;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Delivery {
  id: string;
  site_id: string | null;
  delivery_number: number;
  order_id: string | null;
  sale_id: string | null;
  driver_id: string | null;
  status: DeliveryStatus;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_fee: number;
  commission_amount: number;
  notes: string;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryWithDriver extends Delivery {
  driver: Pick<Driver, 'id' | 'name' | 'phone' | 'photo_url'> | null;
}

export interface DriverPayment {
  id: string;
  site_id: string | null;
  driver_id: string;
  delivery_id: string | null;
  payment_type: DriverPaymentType;
  amount: number;
  status: DriverPaymentStatus;
  notes: string;
  paid_at: string | null;
  created_at: string;
}

// ============================================================
// CUSTOMERS
// ============================================================
export interface Customer {
  id: string;
  site_id: string | null;
  name: string;
  phone: string;
  address: string;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Cart types (in-memory only)
export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  variant_label: string;
  kitchen_note: string;
  unit_price: number;
}

// ============================================================
// SETTINGS
// ============================================================
export interface RestaurantSettings {
  restaurant_name: string;
  currency: string;
  currency_symbol: string;
  tax_rate: number;
  timezone: string;
  primary_color: string;
  accent_color: string;
  logo_url: string | null;
  active_modules: {
    pos: boolean;
    delivery: boolean;
    kitchen: boolean;
    inventory: boolean;
    reports: boolean;
    reservations: boolean;
    production: boolean;
  };
  dashboard_widgets: {
    live_orders: boolean;
    alerts: boolean;
  };
  receipt_footer: string;
  address: string;
  phone: string;
  siret: string;
  vat_number: string;
  legal_form: string;
  capital: string;
}

// ============================================================
// ONLINE ORDERS
// ============================================================
export type OnlineOrderStatus = 'new' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
export type OnlineOrderType = 'delivery' | 'takeaway';

export interface OnlineOrderItem {
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  variant_label?: string;
  kitchen_note?: string;
}

export interface OnlineOrder {
  id: string;
  site_id: string | null;
  order_number: number;
  status: OnlineOrderStatus;
  order_type: OnlineOrderType;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  notes: string;
  items: OnlineOrderItem[];
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  source: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
}

// ============================================================
// PRODUCTION & RECIPES
// ============================================================
export interface Ingredient {
  id: string;
  site_id: string | null;
  name: string;
  unit: string;
  cost_per_unit: number;
  stock: number;
  low_stock_threshold: number;
  description: string;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Recipe {
  id: string;
  site_id: string | null;
  product_id: string | null;
  name: string;
  description: string;
  batch_yield: number;
  total_cost: number;
  max_producible: number;
  margin_pct: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecipeItem {
  id: string;
  site_id: string | null;
  recipe_id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  created_at: string;
}

export interface RecipeWithItems extends Recipe {
  items: (RecipeItem & { ingredient: Ingredient | null })[];
  product: Pick<Product, 'id' | 'name' | 'price'> | null;
}

export type ProductionStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface Production {
  id: string;
  site_id: string | null;
  production_number: number;
  recipe_id: string;
  product_id: string | null;
  product_name: string;
  quantity_produced: number;
  total_cost: number;
  unit_cost: number;
  loss_quantity: number;
  loss_reason: string;
  notes: string;
  status: ProductionStatus;
  produced_by: string | null;
  warehouse_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ProductionWithRecipe extends Production {
  recipe: Pick<Recipe, 'id' | 'name' | 'batch_yield'> | null;
}

// ============================================================
// WAREHOUSES
// ============================================================
export interface Warehouse {
  id: string;
  site_id: string | null;
  name: string;
  description: string;
  location: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export interface WarehouseStock {
  id: string;
  site_id: string | null;
  warehouse_id: string;
  ingredient_id: string;
  quantity: number;
  updated_at: string;
}

export interface WarehouseStockWithIngredient extends WarehouseStock {
  ingredient: Ingredient | null;
}

export type TransferStatus = 'pending' | 'validated' | 'cancelled';

export interface WarehouseTransfer {
  id: string;
  site_id: string | null;
  transfer_number: number;
  from_warehouse_id: string;
  to_warehouse_id: string;
  status: TransferStatus;
  notes: string;
  requested_by: string | null;
  validated_by: string | null;
  requested_at: string;
  validated_at: string | null;
  cancelled_at: string | null;
}

export interface WarehouseTransferItem {
  id: string;
  site_id: string | null;
  transfer_id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
}

export interface WarehouseTransferWithDetails extends WarehouseTransfer {
  from_warehouse: Pick<Warehouse, 'id' | 'name'> | null;
  to_warehouse: Pick<Warehouse, 'id' | 'name'> | null;
  items: (WarehouseTransferItem & { ingredient: Pick<Ingredient, 'id' | 'name' | 'unit'> | null })[];
}

// ============================================================
// CASH SESSIONS
// ============================================================
export type CashSessionStatus = 'open' | 'closed';

export interface CashSession {
  id: string;
  site_id: string | null;
  session_number: number;
  cashier_id: string | null;
  closed_by: string | null;
  opened_at: string;
  closed_at: string | null;
  opening_balance: number;
  expected_cash: number;
  actual_cash: number;
  cash_difference: number;
  total_sales: number;
  total_cash: number;
  total_wave: number;
  total_orange_money: number;
  total_card: number;
  sales_count: number;
  notes: string;
  status: CashSessionStatus;
}

export interface CashSessionWithCashiers extends CashSession {
  cashier: Pick<User, 'id' | 'name'> | null;
  closer: Pick<User, 'id' | 'name'> | null;
}

// ============================================================
// DATABASE (Supabase generated types stub)
// ============================================================
export interface Database {
  public: {
    Tables: {
      tenants: { Row: Tenant; Insert: Omit<Tenant, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Tenant, 'id' | 'created_at'>>; };
      sites: { Row: Site; Insert: Omit<Site, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Site, 'id' | 'created_at'>>; };
      roles: { Row: Role; Insert: Omit<Role, 'id' | 'created_at'>; Update: Partial<Omit<Role, 'id' | 'created_at'>>; };
      users: { Row: User; Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>; };
      settings: { Row: Setting; Insert: Omit<Setting, 'id' | 'updated_at'>; Update: Partial<Omit<Setting, 'id'>>; };
      sessions: { Row: Session; Insert: Omit<Session, 'id' | 'logged_in_at'>; Update: Partial<Omit<Session, 'id' | 'logged_in_at'>>; };
      categories: { Row: Category; Insert: Omit<Category, 'id' | 'created_at'>; Update: Partial<Omit<Category, 'id' | 'created_at'>>; };
      products: { Row: Product; Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>; };
      sales: { Row: Sale; Insert: Omit<Sale, 'id' | 'sale_number' | 'created_at'>; Update: Partial<Omit<Sale, 'id' | 'sale_number' | 'created_at'>>; };
      sale_items: { Row: SaleItem; Insert: Omit<SaleItem, 'id' | 'created_at'>; Update: Partial<Omit<SaleItem, 'id' | 'created_at'>>; };
      payments: { Row: Payment; Insert: Omit<Payment, 'id' | 'created_at'>; Update: Partial<Omit<Payment, 'id' | 'created_at'>>; };
      stock_movements: { Row: StockMovement; Insert: Omit<StockMovement, 'id' | 'created_at'>; Update: Partial<Omit<StockMovement, 'id' | 'created_at'>>; };
    };
  };
}
