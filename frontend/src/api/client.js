import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export const disasterApi = {
  // Health
  checkHealth: () => apiClient.get('/health'),

  // Module 1: Disaster Intelligence
  registerIncident: (data) => apiClient.post('/v1/incidents/register', data),
  predictSeverity: (data) => apiClient.post('/v1/incidents/predict-severity', data),
  getIncidents: (params) => apiClient.get('/v1/incidents', { params }),
  getIncidentById: (id) => apiClient.get(`/v1/incidents/${id}`),

  // Module 2: Decision Support & Optimization
  getDepots: () => apiClient.get('/v1/optimization/depots'),
  solveOptimization: () => apiClient.post('/v1/optimization/solve'),
  getAllocations: () => apiClient.get('/v1/optimization/allocations'),
  approveDispatch: (allocationIds, notes) =>
    apiClient.post('/v1/optimization/approve-dispatch', {
      allocation_ids: allocationIds,
      approved: true,
      commander_notes: notes || 'Approved by Incident Commander',
    }),
  getRecommendations: (incidentId) => apiClient.get(`/v1/optimization/recommendations/${incidentId}`),

  // Module 3: Monitoring & Visualization
  getDashboardSummary: () => apiClient.get('/v1/monitoring/summary'),
  getAlerts: () => apiClient.get('/v1/monitoring/alerts'),
  dismissAlert: (alertId) => apiClient.post(`/v1/monitoring/alerts/${alertId}/dismiss`),
  getMapTelemetry: () => apiClient.get('/v1/monitoring/map-telemetry'),
  getAnalyticsData: () => apiClient.get('/v1/monitoring/analytics-data'),
};

export default apiClient;
