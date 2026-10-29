// Thin re-export so authStore can import apiClient without a circular reference.
// (authStore is imported by client.ts interceptors; this breaks the cycle.)
export { default } from '../api/client';