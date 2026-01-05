import { Order, getOrderInvoice } from './invoiceService';

export interface BillData {
  hotelName: string;
  hotelAddress: string;
  hotelCity: string;
  hotelCountry: string;
  hotelPhone: string;
  hotelEmail: string;
  orderId: string;
  orderDate: string;
  orderType: string;
  paymentMethod: string;
  customerName: string;
  roomNumber?: string;
  tableNumber?: string;
  items: BillItem[];
  subtotal: number;
  serviceCharge: number;
  serviceChargeRate?: number;
  total: number;
  paidAmount: number;
  givenAmount: number;
  changeAmount: number;
  cashier: string;
}

export interface BillItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
  notes?: string;
}

/**
 * Fetch order data from invoice endpoint and map to thermal printer bill data
 */
export async function fetchAndMapOrderToBillData(orderId: string | number): Promise<BillData> {
  // Fetch complete order data from invoice endpoint
  const { order } = await getOrderInvoice(orderId);
  return mapOrderToBillData(order);
}

/**
 * Maps API Order response to thermal printer bill data
 */
export function mapOrderToBillData(order: Order): BillData {
  // Extract hotel details
  const hotel = order.hotel || {};
  const hotelName = hotel.hotel_name || 'Hotel';
  const hotelAddress = hotel.address || '';
  const hotelCity = hotel.city || '';
  const hotelCountry = hotel.country || '';
  const hotelPhone = hotel.number || '';
  const hotelEmail = hotel.email || '';

  // Extract order details
  const orderId = order.id?.toString() || '';
  const orderDate = order.finalize_date || order.created_at || '';
  const orderType = order.type || 'Dine In';
  const paymentMethod = order.payment_method || 'Cash';
  const customerName = order.customer_name || (order.reservation ? `${order.reservation.first_name} ${order.reservation.last_name}`.trim() : 'Guest');

  // Extract room/table info
  const roomNumber = order.room?.room_number;
  const tableNumber = order.table_id?.toString();

  // Map order items
  const items: BillItem[] = (order.order_list_detail || []).map(item => ({
    name: item.recipe_name || 'Item',
    quantity: item.quantity || 0,
    price: item.price || 0,
    total: item.total || 0,
  }));

  // Calculate totals
  const subtotal = order.sub_total || 0;
  const serviceCharge = order.service_charge || 0;
  const total = order.total || 0;
  const paidAmount = order.paid_amount || 0;
  const givenAmount = order.given_amount || 0;
  const changeAmount = order.change_amount || 0;

  // Calculate service charge rate if applicable
  let serviceChargeRate: number | undefined;
  if (serviceCharge > 0 && subtotal > 0) {
    serviceChargeRate = (serviceCharge / subtotal) * 100;
  }

  // Cashier info
  const cashier = order.user?.name || 'Staff';

  return {
    hotelName,
    hotelAddress,
    hotelCity,
    hotelCountry,
    hotelPhone,
    hotelEmail,
    orderId,
    orderDate,
    orderType,
    paymentMethod,
    customerName,
    roomNumber,
    tableNumber,
    items,
    subtotal,
    serviceCharge,
    serviceChargeRate,
    total,
    paidAmount,
    givenAmount,
    changeAmount,
    cashier,
  };
}
