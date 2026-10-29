import Constants from 'expo-constants';

// ──────────────────────────────────────────
// API Base URL — read from app.json extra
// For port-forwarding: set apiBaseUrl in app.json
// e.g. "http://192.168.1.10:8080/wp-json/ev360/v1"
// ──────────────────────────────────────────
export const API_BASE_URL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string) ||
  'http://122.173.84.178:8030/ev360/wp-json/ev360/v1';

// ──────────────────────────────────────────
// Endpoint paths
// ──────────────────────────────────────────
export const ENDPOINTS = {
  // Auth
  AUTH_REGISTER: '/auth/register',
  AUTH_LOGIN: '/auth/login',
  AUTH_LOGOUT: '/auth/logout',
  AUTH_PROFILE: '/auth/profile',

  // Vehicles (public catalogue)
  VEHICLES: '/vehicles',
  VEHICLE: (id: number) => `/vehicles/${id}`,

  // User Vehicles
  USER_VEHICLES: '/user/vehicles',
  USER_VEHICLE: (id: number) => `/user/vehicles/${id}`,

  // Service Requests
  SERVICES: '/services',
  SERVICE: (id: number) => `/services/${id}`,
  SERVICE_TYPES: '/services/types',
  SERVICE_LOCATION: (id: number) => `/services/${id}/location`,
  SERVICE_TECHNICIAN_LOCATION: (id: number) => `/services/${id}/technician-location`,

  // Technician / Admin
  ADMIN_SERVICES: '/admin/services',
  ADMIN_SERVICE: (id: number) => `/admin/services/${id}`,
  ADMIN_SERVICE_PUSH_LOCATION: (id: number) => `/admin/services/${id}/technician-location`,

  // Charging Stations
  CHARGING_STATIONS: '/charging-stations',
  CHARGING_STATION: (id: number) => `/charging-stations/${id}`,
  CHARGING_STATIONS_NEARBY: '/charging-stations/nearby',

  // Service Centers
  SERVICE_CENTERS: '/service-centers',
  SERVICE_CENTER: (id: number) => `/service-centers/${id}`,
  SERVICE_CENTERS_NEARBY: '/service-centers/nearby',

  // Notifications
  NOTIFICATIONS: '/notifications',
  NOTIFICATION_READ: (id: number) => `/notifications/${id}/read`,
  NOTIFICATIONS_READ_ALL: '/notifications/read-all',
  NOTIFICATIONS_DEVICE: '/notifications/device',
} as const;

// ──────────────────────────────────────────
// Request timeouts
// ──────────────────────────────────────────
export const API_TIMEOUT = 15000; // 15s

// ──────────────────────────────────────────
// TanStack Query keys
// ──────────────────────────────────────────
export const QUERY_KEYS = {
  // Auth
  profile: ['profile'] as const,

  // Vehicles
  vehicles: (filters?: object) => ['vehicles', filters] as const,
  vehicle: (id: number) => ['vehicle', id] as const,
  userVehicles: ['userVehicles'] as const,
  userVehicle: (id: number) => ['userVehicle', id] as const,

  // Service requests
  serviceTypes: ['serviceTypes'] as const,
  myRequests: (status?: string) => ['myRequests', status] as const,
  serviceRequest: (id: number) => ['serviceRequest', id] as const,
  technicianLocation: (requestId: number) => ['technicianLocation', requestId] as const,

  // Admin / Technician
  adminRequests: (filters?: object) => ['adminRequests', filters] as const,

  // Map data
  nearbyStations: (lat: number, lng: number, radius?: number) =>
    ['nearbyStations', lat, lng, radius] as const,
  nearbyServiceCenters: (lat: number, lng: number, radius?: number) =>
    ['nearbyServiceCenters', lat, lng, radius] as const,
  chargingStation: (id: number) => ['chargingStation', id] as const,
  serviceCenter: (id: number) => ['serviceCenter', id] as const,

  // Notifications
  notifications: ['notifications'] as const,
} as const;

// ──────────────────────────────────────────
// Storage keys
// ──────────────────────────────────────────
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'ev360_auth_token',
  USER_DATA: 'ev360_user_data',
} as const;

// ──────────────────────────────────────────
// Service type labels
// ──────────────────────────────────────────
export const SERVICE_TYPE_LABELS: Record<string, string> = {
  emergency_charging:    '⚡ Emergency Charging',
  breakdown_assistance:  '🆘 Breakdown Assistance',
  scheduled_maintenance: '🛠️ Scheduled Maintenance',
  inspection:            '🔍 Inspection',
  battery_check:         '🔋 Battery Check',
  software_update:       '💾 Software Update',
  general_repair:        '🔧 General Repair',
};

export const SERVICE_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  accepted: 'Accepted',
  on_the_way: 'On The Way',
  arrived: 'Arrived',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  assigned: '#3B82F6',
  accepted: '#8B5CF6',
  on_the_way: '#06B6D4',
  arrived: '#10B981',
  in_progress: '#F97316',
  completed: '#22C55E',
  cancelled: '#EF4444',
};