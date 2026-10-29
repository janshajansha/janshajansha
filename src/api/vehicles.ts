import apiClient from './client';
import { ENDPOINTS } from '../constants/api';
import { Vehicle, UserVehicle, AddVehiclePayload, PaginatedResponse } from '../types';

export interface VehicleFilters {
  page?: number;
  per_page?: number;
  search?: string;
  brand?: string;
  model?: string;
  year?: number;
  featured?: boolean;
}

export const vehiclesApi = {
  /**
   * GET /vehicles — public catalogue (paginated, filterable)
   */
  getVehicles: async (
    filters?: VehicleFilters
  ): Promise<PaginatedResponse<Vehicle>> => {
    const { data } = await apiClient.get(ENDPOINTS.VEHICLES, { params: filters });
    return data;
  },

  /**
   * GET /vehicles/{id}
   */
  getVehicle: async (id: number): Promise<{ success: boolean; vehicle: Vehicle }> => {
    const { data } = await apiClient.get(ENDPOINTS.VEHICLE(id));
    return data;
  },

  /**
   * GET /user/vehicles — authenticated user's registered vehicles
   */
  getMyVehicles: async (): Promise<{ success: boolean; vehicles: UserVehicle[] }> => {
    const { data } = await apiClient.get(ENDPOINTS.USER_VEHICLES);
    return data;
  },

  /**
   * GET /user/vehicles/{id}
   */
  getMyVehicle: async (
    id: number
  ): Promise<{ success: boolean; vehicle: UserVehicle }> => {
    const { data } = await apiClient.get(ENDPOINTS.USER_VEHICLE(id));
    return data;
  },

  /**
   * POST /user/vehicles
   */
  addVehicle: async (
    payload: AddVehiclePayload
  ): Promise<{ success: boolean; vehicle: UserVehicle }> => {
    const { data } = await apiClient.post(ENDPOINTS.USER_VEHICLES, payload);
    return data;
  },

  /**
   * PATCH /user/vehicles/{id}
   */
  updateVehicle: async (
    id: number,
    payload: Partial<AddVehiclePayload>
  ): Promise<{ success: boolean; vehicle: UserVehicle }> => {
    const { data } = await apiClient.patch(ENDPOINTS.USER_VEHICLE(id), payload);
    return data;
  },

  /**
   * DELETE /user/vehicles/{id}
   */
  deleteVehicle: async (id: number): Promise<{ success: boolean; message: string }> => {
    const { data } = await apiClient.delete(ENDPOINTS.USER_VEHICLE(id));
    return data;
  },
};