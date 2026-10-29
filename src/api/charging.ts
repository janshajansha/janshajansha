import apiClient from './client';
import { ENDPOINTS } from '../constants/api';
import { ChargingStation, ServiceCenter } from '../types';

export interface NearbyParams {
  lat: number;
  lng: number;
  radius_km?: number;
  charging_type?: string;
}

// ──────────────────────────────────────────
// Charging Stations
// ──────────────────────────────────────────
export const chargingApi = {
  /**
   * GET /charging-stations/nearby
   */
  getNearbyStations: async (
    params: NearbyParams
  ): Promise<{ success: boolean; stations: ChargingStation[]; total: number }> => {
    const { data } = await apiClient.get(ENDPOINTS.CHARGING_STATIONS_NEARBY, { params });
    return data;
  },

  /**
   * GET /charging-stations
   */
  getStations: async (params?: {
    page?: number;
    per_page?: number;
    status?: string;
    connector_type?: string;
    fast_charging?: boolean;
  }): Promise<{ success: boolean; stations: ChargingStation[]; total: number }> => {
    const { data } = await apiClient.get(ENDPOINTS.CHARGING_STATIONS, { params });
    return data;
  },

  /**
   * GET /charging-stations/{id}
   */
  getStation: async (
    id: number
  ): Promise<{ success: boolean; station: ChargingStation }> => {
    const { data } = await apiClient.get(ENDPOINTS.CHARGING_STATION(id));
    return data;
  },
};

// ──────────────────────────────────────────
// Service Centers
// ──────────────────────────────────────────
export const serviceCentersApi = {
  /**
   * GET /service-centers/nearby
   */
  getNearbyCenters: async (
    params: Pick<NearbyParams, 'lat' | 'lng' | 'radius_km'>
  ): Promise<{ success: boolean; centers: ServiceCenter[]; total: number }> => {
    const { data } = await apiClient.get(ENDPOINTS.SERVICE_CENTERS_NEARBY, { params });
    return data;
  },

  /**
   * GET /service-centers
   */
  getCenters: async (params?: {
    page?: number;
    per_page?: number;
    status?: string;
  }): Promise<{ success: boolean; centers: ServiceCenter[]; total: number }> => {
    const { data } = await apiClient.get(ENDPOINTS.SERVICE_CENTERS, { params });
    return data;
  },

  /**
   * GET /service-centers/{id}
   */
  getCenter: async (
    id: number
  ): Promise<{ success: boolean; center: ServiceCenter }> => {
    const { data } = await apiClient.get(ENDPOINTS.SERVICE_CENTER(id));
    return data;
  },
};

// ──────────────────────────────────────────
// Notifications API
// ──────────────────────────────────────────
export const notificationsApi = {
  getNotifications: async (): Promise<{
    success: boolean;
    notifications: import('../types').Notification[];
    unread_count: number;
  }> => {
    const { data } = await apiClient.get('/notifications');
    return data;
  },

  markRead: async (id: number): Promise<{ success: boolean }> => {
    const { data } = await apiClient.patch(`/notifications/${id}/read`);
    return data;
  },

  markAllRead: async (): Promise<{ success: boolean }> => {
    const { data } = await apiClient.post('/notifications/read-all');
    return data;
  },
};