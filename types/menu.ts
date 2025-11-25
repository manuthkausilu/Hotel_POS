export interface MenuItem {
	id: number;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
	price: number;
	name: string;
	image: string | null;
	hotel_id: number;
	status: string;
	combo_level: string;
	type: string;
	recipe_id: number | null;
	special_note: string | null;
	item_code: string;
	is_available: number;

	// optional combo structures returned by single-item endpoint
	combo?: Combo[];                // original combo array (if present)
	combo_items?: MenuItem[];       // normalized list of menus extracted from combo -> combo_item -> menu
	recipe?: Recipe | null;         // some nested responses include a recipe object
}

// new types for combo shapes
export interface Combo {
	id: number;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
	menu_id: number;
	maximum_count: number;
	item: number;
	combo_item?: ComboItem[] | null;
}

export interface ComboItem {
	id: number;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
	recipe_id?: number | null;
	combo_id: number;
	quantity: number;
	menu_id: number;
	type?: string | null;
	menu?: MenuItem | null; // nested menu representing the combo component
}

export interface Recipe {
	id: number;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
	name: string;
	hotel_id: number;
	image?: string | null;
}

export interface HotelChain {
	id: number;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
	name: string;
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
	next_invoice_date?: string | null;
	room_count?: string | null;
	system_pricing_category_id?: number | null;
	room_service_charge?: string | null;
	room_service_charge_enabled?: number | null;
	restaurant_service_charge?: string | null;
	restaurant_service_charge_enabled?: number | null;
	resturant?: any;
	hotel_chain?: HotelChain | null;
}

export interface Restaurant {
	id: number;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
	name: string;
	hotel_chain_id: number;
	hotel_id: number;
	status: string;
	cash_payment?: number;
	card_payment?: number;
	hotel?: Hotel | null;
}

export interface CashBook {
	id: number;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
	name: string;
	hotel_id: number;
	status: string;
	balance: number | null;
}

export interface Table {
	id: number;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
	hotel_id: number;
	table_name: string;
	nu_of_chairs: number;
	area: string;
	status: string | null;
}

export interface Category {
	id: number;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
	category_name: string;
	hotel_id: number;
}

export interface MenuResponse {
	menus: MenuItem[];
	restaurant: Restaurant;
	cash_books: CashBook[];
	customers: any[];
	recipeCategoriesWithMenus: Record<string, number[]>;
	tables: Table[];
	categories?: { id: number; name?: string }[];
}