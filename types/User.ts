export interface User {
	id: number | string;
	name: string;
	lname?: string;
	email: string;
	email_verified_at?: string | null;
	created_at?: string;
	updated_at?: string;
	status?: string;
	role?: string;
	// keep index signature for any additional fields if necessary
	[key: string]: any;
}
