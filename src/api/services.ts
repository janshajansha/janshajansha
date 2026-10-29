import apiClient from './client';
import { ENDPOINTS } from '../constants/api';
import {
  ServiceRequest,
  ServiceTypeOption,
  CreateServiceRequestPayload,
  UpdateLocationPayload,
  TechnicianUpdatePayload,
  TechnicianLocation,
} from '../types';

export interface ServiceListFilters {
  status?: string;
}

export interface AdminServiceFilters extends ServiceListFilters {
  type?: string;
  page?: number;
  per_page?: number;
  assigned_technician_id?: number; // pass logged-in technician's ID to scope results
}

export const servicesApi = {
  // ──────────────────────────────────────────
  // Public
  // ──────────────────────────────────────────

  /**
   * GET /services/types
   */
  getServiceTypes: async (): Promise<{ success: boolean; types: ServiceTypeOption[] }> => {
    const { data } = await apiClient.get(ENDPOINTS.SERVICE_TYPES);
    return data;
  },

  // ──────────────────────────────────────────
  // Customer routes
  // ──────────────────────────────────────────

  /**
   * GET /services — authenticated customer's own requests
   */
  getMyRequests: async (
    filters?: ServiceListFilters
  ): Promise<{ success: boolean; requests: ServiceRequest[] }> => {
    const { data } = await apiClient.get(ENDPOINTS.SERVICES, { params: filters });
    return data;
  },

  /**
   * POST /services
   */
  createRequest: async (
    payload: CreateServiceRequestPayload
  ): Promise<{ success: boolean; request: ServiceRequest }> => {
    const { data } = await apiClient.post(ENDPOINTS.SERVICES, payload);
    return data;
  },

  /**
   * GET /services/{id}
   */
  getRequest: async (id: number): Promise<{ success: boolean; request: ServiceRequest }> => {
    const { data } = await apiClient.get(ENDPOINTS.SERVICE(id));
    return data;
  },

  /**
   * DELETE /services/{id} — cancel (customer, pending only)
   */
  cancelRequest: async (id: number): Promise<{ success: boolean; message: string }> => {
    const { data } = await apiClient.delete(ENDPOINTS.SERVICE(id));
    return data;
  },

  /**
   * POST /services/{id}/location — customer pushes live location
   */
  updateMyLocation: async (
    requestId: number,
    payload: UpdateLocationPayload
  ): Promise<{ success: boolean }> => {
    const { data } = await apiClient.post(ENDPOINTS.SERVICE_LOCATION(requestId), payload);
    return data;
  },

  /**
   * GET /services/{id}/technician-location — customer polls technician
   */
  getTechnicianLocation: async (requestId: number): Promise<TechnicianLocation> => {
    const { data } = await apiClient.get(
      ENDPOINTS.SERVICE_TECHNICIAN_LOCATION(requestId)
    );
    return data;
  },

  // ──────────────────────────────────────────
  // Technician / Admin routes
  // ──────────────────────────────────────────

  /**
   * GET /admin/services — list all requests (with filters)
   */
  getAdminRequests: async (
    filters?: AdminServiceFilters
  ): Promise<{ success: boolean; requests: ServiceRequest[]; total: number }> => {
    const { data } = await apiClient.get(ENDPOINTS.ADMIN_SERVICES, { params: filters });
    return data;
  },

  /**
   * PATCH /admin/services/{id} — update status, assign technician, update location
   */
  updateRequest: async (
    id: number,
    payload: TechnicianUpdatePayload
  ): Promise<{ success: boolean; request: ServiceRequest }> => {
    const { data } = await apiClient.patch(ENDPOINTS.ADMIN_SERVICE(id), payload);
    return data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Technician location push
//
// Separate from servicesApi to make the call site explicit.
// The technician dashboard imports this directly.
// ─────────────────────────────────────────────────────────────────────────────
export const pushTechnicianLocation = async (
  requestId: number,
  lat: number,
  lng: number
): Promise<void> => {
  await apiClient.post(ENDPOINTS.ADMIN_SERVICE_PUSH_LOCATION(requestId), { lat, lng });
};