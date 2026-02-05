import axios from 'axios';
import { apiClient } from '../apiClient';

export interface OrderListDetail {
	id: number;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
	recipe_name: string;
	price: number;
	quantity: number;
	discount: number;
	total: number;
	order_list_id: number;
	recipe_note_id: number;
	como_items_list: string; // JSON string
	status: string | null;
}

export interface Reservation {
	id: number;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
	first_name: string;
	last_name: string;
	booking_method: string;
	address: string | null;
	country: string;
	passport_number: string | null;
	email: string;
	phone: string;
	whatsapp_number: string;
	check_in_date: string;
	check_out_date: string;
	room_type1: string;
	guests: number;
	special_note: string | null;
	nights: number | null;
	room_type2: string | null;
	room_type3: string | null;
	breakfast: string;
	room_chagers_lkr: number;
	room_chagers_usd: number | null;
	card_payment: number | null;
	cash_payment: number | null;
	advance_payment: number | null;
	hotel_id: number;
	balance: number;
	customer_id: number;
	booking_sync: string;
}

export interface Room {
	id: number;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
	hotel_id: number;
	room_number: string;
	room_type: string;
	room_category_id: number;
	status: string | null;
	check_list_layout_id: number;
	wifi_id: number;
	reapair: string | null;
	is_visible: number;
}

export interface User {
	id: number;
	name: string;
	email: string;
	email_verified_at: string | null;
	created_at: string;
	updated_at: string;
	lname: string;
	status: string;
	role: string;
	hotel_chain_id: number;
	user_type: string | null;
	mode: string | null;
	hotel_id: number;
}

export interface Hotel {
	id: number;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
	hotel_name: string;
	hotel_chain_id: number;
	country: string;
	city: string;
	address: string;
	email: string;
	number: string;
	status: string;
	next_invoice_date: string;
	room_count: string;
	system_pricing_category_id: number;
	room_service_charge: string;
	room_service_charge_enabled: number;
	restaurant_service_charge: string;
	restaurant_service_charge_enabled: number;
	resturant: string | null;
}

export interface Order {
	id: number;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
	type: string;
	status: string;
	customer_name: string | null;
	sub_total: number;
	total: number;
	service_charge: number;
	item_count: number;
	paid_amount: number;
	due_amount: number;
	given_amount: number;
	change_amount: number;
	finalize_date: string;
	reason: string | null;
	hotel_id: number;
	order_all_recipes: string; // JSON string
	restaurant_id: number;
	payment_method: string;
	user_id: number;
	reservation_id: number;
	room_id: number | null;
	table_id: number | null;
	steward_id: number;
	order_list_detail: OrderListDetail[];
	reservation: Reservation;
	room: Room;
	user: User;
	hotel: Hotel;
}

export interface InvoiceResponse {
	success: boolean;
	order: Order;
	invoice_url: string;
}

/**
 * Fetch invoice data for an order.
 * Returns { invoiceUrl, order } on success.
 * Throws an Error with server message when failed.
 */
export async function getOrderInvoice(orderId: string | number): Promise<{ invoiceUrl: string; order: Order }> {
	const endpoint = `/pos/orders/${orderId}/invoice`;
	try {
		console.log('📥 Fetching invoice from:', endpoint);
		const res = await apiClient.get<InvoiceResponse>(endpoint);
		const data = res.data;

		console.log('📦 Invoice API response success:', data?.success);

		if (data && data.success && data.order && data.invoice_url) {
			console.log('✅ Invoice data received for order:', orderId);
			// Ensure invoice URL is absolute
			let invoiceUrl = data.invoice_url;
			if (!invoiceUrl.startsWith('http')) {
				const baseURL = apiClient.defaults.baseURL || 'https://app.trackerstay.com';
				invoiceUrl = `${baseURL}${invoiceUrl.startsWith('/') ? invoiceUrl : '/' + invoiceUrl}`;
			}
			console.log('🔗 Invoice URL:', invoiceUrl);

			return {
				invoiceUrl,
				order: data.order
			};
		}

		// If API returns success=false, try to surface message if present
		const apiMessage = (data as any)?.message || 'Failed to fetch invoice';
		throw new Error(apiMessage);
	} catch (err) {
		if (axios.isAxiosError(err)) {
			const serverMsg = (err.response?.data as any)?.message || err.message;
			console.error('⚠️ API error fetching invoice:', serverMsg);
			throw new Error(serverMsg);
		}
		console.error('⚠️ Unexpected error fetching invoice:', (err as Error).message);
		throw err;
	}
}