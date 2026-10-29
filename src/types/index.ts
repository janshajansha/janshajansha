// ============================================================
// EV360 – Complete TypeScript Types
// Generated from backend API analysis
// ============================================================

// ──────────────────────────────────────────
// Auth & User
// ──────────────────────────────────────────
export type UserRole = 'ev360_customer' | 'ev360_technician' | 'administrator';

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  roles: UserRole[];
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token: string;
  user: User;
}

export interface LoginPayload {
  email: string;
  password: string;
  device_name?: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  device_name?: string;
}

export interface UpdateProfilePayload {
  first_name?: string;
  last_name?: string;
  phone?: string;
}

// ──────────────────────────────────────────
// Vehicles
// ──────────────────────────────────────────
export interface Vehicle {
  id: number;
  title: string;
  make: string[];
  model: string[];
  type: string[];
  ev_type: string[];
  year: number | null;
  range_km: number | null;
  battery_capacity: number | null;
  charging_speed: number | null;
  connector_types: string[];
  featured_vehicle: boolean;
  image_url: string | null;
  thumbnail_url: string | null;
  status: string;
}

export interface UserVehicle {
  id: number;
  vehicle_id: number | null;
  user_id: number;
  post_id: number | null;
  make: string;
  model: string;
  color: string | null;
  year: number | null;
  vin: string | null;
  battery_capacity: number | null;
  charging_type: string | null;
  charging_speed: number | null;
  range_km: number | null;
  current_odometer: number | null;
  vehicle_image: string | null;
  plate_number: string | null;
  insurance_expiry: string | null;
  warranty_expiry: string | null;
  purchase_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AddVehiclePayload {
  make: string;
  model: string;
  year?: number;
  color?: string;
  vin?: string;
  battery_capacity?: number;
  charging_type?: string;
  charging_speed?: number;
  range_km?: number;
  current_odometer?: number;
  plate_number?: string;
  insurance_expiry?: string;
  warranty_expiry?: string;
  purchase_date?: string;
  vehicle_id?: number;
}

// ──────────────────────────────────────────
// Service Requests
// ──────────────────────────────────────────
export type ServiceType =
  | 'emergency_charging'
  | 'breakdown_assistance'
  | 'scheduled_maintenance'
  | 'inspection'
  | 'battery_check'
  | 'software_update'
  | 'general_repair';
export type ServicePriority = 'low' | 'normal' | 'high' | 'critical';
export type ServiceStatus =
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'on_the_way'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface ServiceTypeOption {
  key: ServiceType;
  label: string;
}

export interface ServiceRequest {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  assigned_technician_id: number | null;
  assigned_technician_name: string | null;
  user_vehicle_id: number | null;
  user_vehicle_title: string | null;
  user_vehicle_plate: string | null;
  service_type: ServiceType;
  status: ServiceStatus;
  priority: ServicePriority;
  priority_label: string | null;
  description: string | null;
  customer_notes: string | null;
  admin_notes: string | null;
  technician_notes: string | null;
  location: {
    address: string;
    lat: string;
    lng: string;
  },
  location_lat: number | null;
  location_lng: number | null;
  location_address: string | null;
  technician_lat: number | null;
  technician_lng: number | null;
  eta: string | null;
  scheduled_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  status_log: {
    old_status: string;
    new_status: string;
    changed_at: string;
    note: string | null;
  }[];
}

export interface CreateServiceRequestPayload {
  service_type: ServiceType;
  priority?: ServicePriority;
  description?: string;
  user_vehicle_id?: number;
  location_lat?: number;
  location_lng?: number;
  location_address?: string;
  customer_notes?: string;
  scheduled_at?: string;
}

export interface UpdateLocationPayload {
  lat: number;
  lng: number;
  address?: string;
}

export interface TechnicianUpdatePayload {
  status?: ServiceStatus;
  technician_notes?: string;
  eta?: string;
  latitude?: number;
  longitude?: number;
  completed_at?: string;
}

export interface TechnicianLocation {
  lat: number | null;
  lng: number | null;
  updated_at: string | null;
  technician_name : string;
  recorded_at : string;
}

// ──────────────────────────────────────────
// Charging Stations
// ──────────────────────────────────────────
export interface ChargingStation {
  id: number;
  name: string;
  address: string;
  city: string;
  region: string;
  latitude: number | null;
  longitude: number | null;
  connector_types: string[];
  fast_charging: boolean;
  availability_status: 'operational' | 'under_repair' | 'coming_soon' | 'decommissioned';
  num_ports: number;
  opening_hours: string;
  fee_per_kwh: number | null;
  fee_currency: string;
  phone: string;
  distance_km?: number;
  image_url: string | null;
}

// ──────────────────────────────────────────
// Service Centers
// ──────────────────────────────────────────
export interface ServiceCenter {
  id: number;
  name: string;
  address: string;
  city: string;
  region: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  email: string;
  opening_hours: string;
  services: string[];
  technicians_available: number;
  rating: number | null;
  status: string;
  distance_km?: number;
  image_url: string | null;
}

// ──────────────────────────────────────────
// Notifications
// ──────────────────────────────────────────
export interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  sent_at: string;      // backend field name
  created_at?: string;  // alias kept for compatibility
  read_at: string | null;
  data: { request_id?: number; status?: string } | null;
  action_url?: string | null;
  request_id?: number | null; // convenience — parsed from data.request_id if present
}

// ──────────────────────────────────────────
// API Response wrappers
// ──────────────────────────────────────────
export interface ApiSuccess<T> {
  success: true;
  data?: T;
  message?: string;
}

export interface ApiError {
  success: false;
  code: string;
  message: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// ──────────────────────────────────────────
// Navigation param types
// ──────────────────────────────────────────
export type RootStackParamList = {
  Auth: undefined;
  CustomerTabs: undefined;
  TechnicianTabs: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type CustomerTabParamList = {
  Dashboard: undefined;
  Vehicles: undefined;
  Requests: undefined;
  Map: undefined;
  Profile: undefined;
};

export type CustomerStackParamList = {
  CustomerHome: undefined;
  AddVehicle: { vehicleId?: number };
  VehicleDetail: { vehicleId: number };
  CreateRequest: { vehicleId?: number };
  RequestDetail: { requestId: number };
  TechnicianTracking: { requestId: number };
  ChargingStationDetail: { stationId: number };
  ServiceCenterDetail: { centerId: number };
};

export type TechnicianTabParamList = {
  TechDashboard: undefined;
  TechRequests: undefined;
  TechProfile: undefined;
};

export type TechnicianStackParamList = {
  TechRequestDetail: { requestId: number };
  TechNavigation: { requestId: number; lat: number; lng: number };
};