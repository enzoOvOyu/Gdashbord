import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 15000 });

// Dashboard
export const getOverview = (range = 7) => api.get('/overview', { params: { range } }).then(r => r.data);

// 实例
export const getInstances = () => api.get('/instances').then(r => r.data);
export const instanceAction = (id, action) => api.post(`/instances/${id}/action`, { action }).then(r => r.data);
export const createInstance = (payload) => api.post('/instances', payload).then(r => r.data);
export const getInstanceMetrics = (id) => api.get(`/instances/${id}/metrics`).then(r => r.data);
export const getInstanceLogs = (id, lines = 120) => api.get(`/instances/${id}/logs`, { params: { lines } }).then(r => r.data);

// GPU 市场
export const getGpus = (params) => api.get('/gpus', { params }).then(r => r.data);
export const getRegions = () => api.get('/gpus/regions').then(r => r.data);

// 镜像
export const getImages = (category) => api.get('/images', { params: { category } }).then(r => r.data);

// 费用
export const getBilling = () => api.get('/billing').then(r => r.data);

export default api;
