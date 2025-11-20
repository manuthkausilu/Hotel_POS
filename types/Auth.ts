export interface LoginRequest {
  email: string;
  password: string;
  device_name: string;
}

export interface LoginResponse {
  token: string;
  token_type: string;
  user?: User;
}

export interface User {
  id: number;
  name: string;
  email: string;
  email_verified_at: string | null;
  role?: string;
}
