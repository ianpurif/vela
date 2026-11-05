import type {
  Category,
  FulfillmentStatus,
  Order,
  PaymentStatus,
  Product,
  SiteContent,
  UserProfile,
} from "./commerce";

export type AdminOrderFilters = {
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  after?: string;
};
export type AdminOrderList = {
  orders: Order[];
  limit: 200;
  truncated: boolean;
  next: string | null;
};
export type AdminCustomerList = { customers: UserProfile[]; limit: 100; truncated: boolean };
export type AdminCustomerDetail = {
  profile: UserProfile;
  orders: Order[];
  ordersLimit: 200;
  ordersTruncated: boolean;
};
export type AdminContent = { content: SiteContent; categories: Category[] };
export type AnalyticsDay = { date: string; orders: number; paidOrders: number; revenue: number };
export type Bestseller = { productId: string; name: string; quantity: number; revenue: number };
export type AdminAnalytics = {
  window: { days: number; startAt: number; endAt: number; timezone: "UTC" };
  /** Monetary amounts are integer USD cents; revenue and AOV include shipping. */
  metrics: {
    revenue: number;
    paidOrders: number;
    orders: number;
    pendingOrders: number;
    averageOrderValue: number;
    products: number;
  };
  trend: AnalyticsDay[];
  /** Snapshot line revenue excludes shipping. */
  bestsellers: Bestseller[];
  recentOrders: Order[];
  lowStock: Product[];
  scope: {
    orderLimit: 1000;
    productLimit: 1000;
    createdOrders: number;
    paidOrders: number;
    products: number;
    createdOrdersTruncated: boolean;
    paidOrdersTruncated: boolean;
    productsTruncated: boolean;
    truncated: boolean;
  };
};
