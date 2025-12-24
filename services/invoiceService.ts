import axios from 'axios';
import { apiClient } from './apiClient';

export type Order = Record<string, any>;

export interface RawInvoiceResponse {
	success: boolean;
	order?: Order;
	invoice_url?: string;
	// ...other possible fields...
}

/**
 * Fetch invoice data for an order.
 * Returns { invoiceUrl, order } on success.
 * Throws an Error with server message when failed.
 */
export async function getOrderInvoice(orderId: string | number): Promise<{ invoiceUrl?: string; order?: Order }> {
	const endpoint = `/pos/orders/${orderId}/invoice`;
	try {
		console.log('📥 Fetching invoice:', endpoint);
		const res = await apiClient.get<RawInvoiceResponse>(endpoint);
		const data = res.data;
		if (data && data.success) {
			return { invoiceUrl: data.invoice_url, order: data.order };
		}
		// If API returns success=false, try to surface message if present
		const apiMessage = (res.data as any)?.message || 'Failed to fetch invoice';
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
}9