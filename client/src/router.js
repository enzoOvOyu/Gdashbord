import { createRouter, createWebHistory } from 'vue-router';
import MainLayout from './layouts/MainLayout.vue';

const routes = [
  {
    path: '/',
    component: MainLayout,
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'Dashboard', component: () => import('./views/Dashboard.vue'), meta: { title: 'Dashboard' } },
      { path: 'market', name: 'GpuMarket', component: () => import('./views/GpuMarket.vue'), meta: { title: 'GPU 算力市场' } },
      { path: 'create', name: 'CreateInstance', component: () => import('./views/CreateInstance.vue'), meta: { title: '创建实例' } },
      { path: 'instances', name: 'InstanceList', component: () => import('./views/InstanceList.vue'), meta: { title: '实例管理' } },
      { path: 'monitor', name: 'Monitor', component: () => import('./views/Monitor.vue'), meta: { title: '监控中心' } },
      { path: 'images', name: 'ImageMarket', component: () => import('./views/ImageMarket.vue'), meta: { title: '镜像商城' } },
      { path: 'billing', name: 'Billing', component: () => import('./views/Billing.vue'), meta: { title: '费用中心' } },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
