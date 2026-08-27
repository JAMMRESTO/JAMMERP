export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'SERVEUR' | 'CAISSIER';

export type TableStatut = 'LIBRE' | 'OCCUPEE' | 'SERVIE' | 'A_ENCAISSER';

export type OrderStatut = 'BROUILLON' | 'VALIDE' | 'PAYEE' | 'ANNULEE' | 'CLOTUREE';

export type PaymentMode = 'ESPECES' | 'AUTRE';

export type PaymentMethod = 'CASH' | 'CARD' | 'WAVE' | 'ORANGE_MONEY' | 'OTHER';

export type PaymentStatus = 'valid' | 'refunded';

export type CashSessionStatus = 'open' | 'closed';

export type CashClosureType = 'X' | 'Z';

export type CashMovementType = 'IN' | 'OUT';

export type ExpenseCategory = 'FOURNITURE' | 'TRANSPORT' | 'SALAIRE' | 'MAINTENANCE' | 'REPAS' | 'AUTRE';

export type PrinterType = 'CUISINE' | 'BAR' | 'CAISSE' | 'AUTRE';

export type PrinterConnectionType = 'NETWORK' | 'USB';

export type PrinterStation = 'KITCHEN' | 'BAR' | 'CASHIER' | 'OTHER';

export type PrintJobType = 'INITIAL' | 'ADDONS' | 'BILL' | 'RECEIPT' | 'TEST' | 'REPORT_X' | 'REPORT_Z';

export type PrintJobStatus = 'PENDING' | 'PRINTING' | 'SUCCESS' | 'DONE' | 'FAILED' | 'WAITING_CASHIER';

export type PrintStation = 'kitchen' | 'bar' | 'cashier' | 'other';


export type OrderType = 'TABLE' | 'DIRECT';

export interface AppSetting {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

export interface Printer {
  id: string;
  nom: string;
  type: PrinterType;
  station: PrinterStation;
  connection_type: PrinterConnectionType;
  ip_address: string;
  port: number;
  usb_name: string | null;
  active: boolean;
  backup_printer_id: string | null;
  relay_last_seen: string | null;
  created_at: string;
}

export interface UserPermissions {
  id: string;
  user_id: string;
  can_view_orders: boolean;
  can_create_orders: boolean;
  can_edit_orders: boolean;
  can_cancel_orders: boolean;
  can_process_payments: boolean;
  can_view_sales_history: boolean;
  can_manage_products: boolean;
  can_manage_tables: boolean;
  can_manage_printers: boolean;
  can_manage_users: boolean;
  can_access_settings: boolean;
  can_print_tickets: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  nom: string;
  pin: string | null;
  role: UserRole;
  actif: boolean;
  created_at: string;
  permissions?: UserPermissions;
}

export interface Zone {
  id: string;
  nom: string;
  ordre: number;
  created_at: string;
}

export interface Table {
  id: string;
  zone_id: string;
  nom: string;
  statut: TableStatut;
  locked_by: string | null;
  created_at: string;
  zone?: Zone;
  locked_by_user?: User;
}

export interface Category {
  id: string;
  nom: string;
  ordre: number;
  actif: boolean;
  printer_id: string | null;
  parent_id: string | null;
  created_at: string;
  printer?: Printer;
  parent?: Category;
  subcategories?: Category[];
}

export interface ProductVariantGroup {
  id: string;
  product_id: string;
  nom: string;
  required: boolean;
  ordre: number;
  created_at: string;
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  group_id: string;
  nom: string;
  prix_delta: number;
  default_selected: boolean;
  actif: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  category_id: string;
  nom: string;
  prix: number;
  image_url: string;
  actif: boolean;
  created_at: string;
  category?: Category;
  options?: ProductOption[];
  variant_groups?: ProductVariantGroup[];
}

export interface ProductOption {
  id: string;
  product_id: string;
  nom: string;
  prix_delta: number;
  created_at: string;
}

export interface Order {
  id: string;
  table_id: string | null;
  serveur_id: string | null;
  caissier_id: string | null;
  order_type: OrderType;
  statut: OrderStatut;
  total: number;
  ticket_number: string;
  created_at: string;
  updated_at: string;
  table?: Table;
  serveur?: User;
  caissier?: User;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  nom_snapshot: string;
  prix_snapshot: number;
  qty: number;
  printed_qty: number;
  paid_qty: number;
  notes: string;
  created_at: string;
  options?: OrderItemOption[];
}

export interface OrderItemOption {
  id: string;
  order_item_id: string;
  nom_snapshot: string;
  prix_delta_snapshot: number;
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  mode: PaymentMode;
  method: PaymentMethod;
  montant: number;
  reference: string;
  caissier_id: string;
  session_id: string | null;
  pay_status: PaymentStatus;
  paid_at: string;
  created_at: string;
}

export interface CashSession {
  id: string;
  caissier_id: string;
  ouverture: string;
  fermeture: string | null;
  total_especes: number;
  notes: string;
  status: CashSessionStatus;
  opening_float: number;
  opened_by: string | null;
  closed_by: string | null;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  opened_by_user?: User;
  closed_by_user?: User;
}

export interface CashMovement {
  id: string;
  session_id: string;
  type: CashMovementType;
  amount: number;
  reason: string;
  created_by: string | null;
  created_at: string;
  created_by_user?: User;
}

export interface CashClosure {
  id: string;
  session_id: string;
  type: CashClosureType;
  created_by: string | null;
  totals_json: CashTotals;
  excluded_unpaid_count: number;
  excluded_unpaid_amount: number;
  cash_counted: number | null;
  cash_difference: number | null;
  notes: string;
  created_at: string;
  created_by_user?: User;
  session?: CashSession;
}

export interface CashTotals {
  period_start: string;
  period_end: string;
  paid_orders_count: number;
  ticket_average: number;
  gross_revenue: number;
  net_revenue: number;
  discounts: number;
  by_method: Record<PaymentMethod, number>;
  by_category: Record<string, number>;
  top_products: Array<{ nom: string; qty: number; amount: number }>;
  all_products: Array<{ nom: string; qty: number; amount: number }>;
  movements_in: number;
  movements_out: number;
  cash_theoretical: number;
  opening_float: number;
  total_expenses: number;
}

export interface Expense {
  id: string;
  restaurant_id: string | null;
  session_id: string | null;
  created_by: string | null;
  category: ExpenseCategory;
  label: string;
  amount: number;
  expense_date: string;
  notes: string;
  created_at: string;
  created_by_user?: User;
}

export interface CartItem {
  product: Product;
  qty: number;
  notes: string;
  selectedOptions: ProductOption[];
  selectedVariants?: Record<string, ProductVariant>;
}

export interface PrintJob {
  id: string;
  order_id: string | null;
  printer_id: string | null;
  table_id: string | null;
  type: PrintJobType;
  content_summary: string;
  payload_text: string;
  status: PrintJobStatus;
  station: PrintStation;
  retries: number;
  printed_at: string | null;
  last_error: string | null;
  error_message: string | null;
  client_request_id: string | null;
  server_id: string | null;
  created_at: string;
  created_by: string | null;
  printer?: Printer;
  table?: Table;
  order?: Order;
  created_by_user?: User;
}

export interface PrintGroup {
  printer: Printer;
  printerType: PrinterType;
  station: PrintStation;
  items: PrintLineItem[];
}

export interface PrintLineItem {
  orderItemId?: string;
  nom: string;
  qty: number;
  notes?: string;
  options?: string[];
  unitPrice: number;
}

export type BillingCycle = 'monthly' | 'annual';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';

export interface Restaurant {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  country: string;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  price_annual: number;
  max_users: number | null;
  max_orders_per_month: number | null;
  max_tables: number | null;
  features: Record<string, boolean>;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Subscription {
  id: string;
  restaurant_id: string;
  plan_id: string;
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  started_at: string;
  expires_at: string | null;
  auto_renew: boolean;
  amount: number;
  created_at: string;
  updated_at: string;
  plan?: SubscriptionPlan;
}
