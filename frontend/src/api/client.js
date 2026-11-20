import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Attach Authorization Bearer token to all outgoing requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('rescuenet_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const disasterApi = {
  // Health
  checkHealth: () => apiClient.get('/health'),

  // Authentication & RBAC
  login: (username, password) => apiClient.post('/v1/auth/login', { username, password }),
  register: (userData) => apiClient.post('/v1/auth/register', userData),
  getMe: () => apiClient.get('/v1/auth/me'),
  logout: () => apiClient.post('/v1/auth/logout'),

  // Citizen Workflow
  reportCitizenIncident: (data) => apiClient.post('/v1/incidents/citizen-report', data),
  sendSOS: (data) => apiClient.post('/v1/incidents/sos', data),
  getMyReports: () => apiClient.get('/v1/incidents/my-reports'),

  // Admin Management & Verification
  getCitizenSubmissions: () => apiClient.get('/v1/incidents/citizen-submissions'),
  updateIncidentStatus: (incidentId, status, commanderNotes) =>
    apiClient.patch(`/v1/incidents/${incidentId}/status`, {
      status,
      commander_notes: commanderNotes,
    }),

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
      commander_notes: notes,
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
