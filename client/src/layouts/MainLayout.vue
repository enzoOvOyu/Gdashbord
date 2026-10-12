<template>
  <div class="gd-layout">
    <!-- 顶部栏 -->
    <header class="gd-header">
      <div class="gd-logo">
        <div class="logo-icon">⚡</div>
        <div>
          云算力 Cloud
          <span class="slogan">让 AI 智算触手可及</span>
        </div>
      </div>
      <el-input
        v-model="search"
        placeholder="搜索实例、镜像、文档..."
        class="header-search"
        size="large"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
        <template #append>⌘K</template>
      </el-input>
      <div style="flex: 1"></div>
      <el-badge :value="3" class="header-icon">
        <el-icon :size="19"><Bell /></el-icon>
      </el-badge>
      <el-icon :size="19" class="header-icon"><QuestionFilled /></el-icon>
      <el-dropdown>
        <span class="user-chip">
          <el-avatar :size="30" style="background: linear-gradient(135deg,#2b6bff,#6d3bff)">张</el-avatar>
          <span style="margin: 0 4px 0 8px">张三</span>
          <el-icon :size="12"><ArrowDown /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item>个人账户</el-dropdown-item>
            <el-dropdown-item>账户设置</el-dropdown-item>
            <el-dropdown-item divided>退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </header>

    <div class="gd-body">
      <!-- 侧边栏 -->
      <aside class="gd-sidebar">
        <nav class="gd-menu">
          <div
            v-for="item in menu"
            :key="item.path"
            class="gd-menu-item"
            :class="{ active: $route.path === item.path }"
            @click="$router.push(item.path)"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            {{ item.label }}
          </div>
        </nav>
        <div class="gd-promo">
          <div class="cube">🧊</div>
          <h4>新一代<br />H200 GPU 上线</h4>
          <p>更强性能、更快延迟，立即体验 AI 训练加速</p>
          <el-button type="primary" round size="small" style="background:#fff;color:#1d4ed8;border:none">立即体验</el-button>
        </div>
      </aside>

      <!-- 主内容 -->
      <main class="gd-main">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import {
  HomeFilled, ShoppingCart, CirclePlus, Files, DataLine,
  Wallet, Headset, Setting, Search, Bell, QuestionFilled, ArrowDown,
} from '@element-plus/icons-vue';

const search = ref('');
const menu = [
  { path: '/dashboard', label: 'Dashboard', icon: HomeFilled },
  { path: '/market', label: 'GPU 算力市场', icon: ShoppingCart },
  { path: '/create', label: '创建实例', icon: CirclePlus },
  { path: '/instances', label: '实例管理', icon: Files },
  { path: '/monitor', label: '监控中心', icon: DataLine },
  { path: '/images', label: '镜像商城', icon: Grid },
  { path: '/billing', label: '费用中心', icon: Wallet },
  { path: '/support', label: '工单支持', icon: Headset },
  { path: '/settings', label: '设置', icon: Setting },
];
</script>

<style scoped>
.header-search { width: 420px; }
.header-search :deep(.el-input__wrapper) { border-radius: 10px; background: #f5f7fa; box-shadow: none; }
.header-icon { cursor: pointer; color: var(--gd-text-2); display: flex; }
.user-chip { display: flex; align-items: center; cursor: pointer; outline: none; }
</style>
