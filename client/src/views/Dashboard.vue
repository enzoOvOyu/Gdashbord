<template>
  <div>
    <!-- 欢迎语 -->
    <div class="page-welcome">
      <h2>欢迎回来，张三 👋</h2>
      <p>今天是 {{ today }}，星期{{ weekday }} · 一起加速你的 AI 创新之旅！</p>
    </div>

    <el-row :gutter="16">
      <!-- ===== 左侧主区 ===== -->
      <el-col :span="18">
        <!-- 统计卡片 -->
        <el-row :gutter="16">
          <el-col :span="6" v-for="s in stats" :key="s.label">
            <div class="gd-card" style="margin-bottom: 16px">
              <div class="stat-card">
                <div class="stat-icon" :style="{ background: s.bg }">{{ s.icon }}</div>
                <div class="stat-info">
                  <div class="stat-label">{{ s.label }}</div>
                  <div class="stat-value">{{ s.value }}</div>
                  <div class="stat-sub">
                    <span>{{ s.sub }}</span>
                    <span :class="s.delta >= 0 ? 'stat-delta-up' : 'stat-delta-down'">
                      {{ s.delta >= 0 ? '↑' : '↓' }} {{ Math.abs(s.delta * 100).toFixed(0) }}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <!-- 近7天费用趋势 -->
          <el-col :span="10">
            <div class="gd-card" style="margin-bottom: 16px">
              <div class="gd-card-title">
                <span>最近7天费用趋势</span>
                <el-radio-group v-model="range" size="small" @change="load">
                  <el-radio-button :value="7">近7天</el-radio-button>
                  <el-radio-button :value="30">近30天</el-radio-button>
                  <el-radio-button :value="90">近90天</el-radio-button>
                </el-radio-group>
              </div>
              <div ref="costChartRef" style="height: 240px"></div>
            </div>
          </el-col>

          <!-- GPU资源使用趋势 -->
          <el-col :span="7">
            <div class="gd-card" style="margin-bottom: 16px">
              <div class="gd-card-title"><span>GPU 资源使用趋势</span></div>
              <div ref="gpuChartRef" style="height: 240px"></div>
            </div>
          </el-col>

          <!-- 实例状态分布 -->
          <el-col :span="7">
            <div class="gd-card" style="margin-bottom: 16px">
              <div class="gd-card-title"><span>实例状态分布</span></div>
              <div ref="statusChartRef" style="height: 240px"></div>
            </div>
          </el-col>
        </el-row>

        <!-- 最近实例 -->
        <div class="gd-card">
          <div class="gd-card-title">
            <span>最近实例</span>
            <el-button text type="primary" @click="$router.push('/instances')">
              查看全部 <el-icon><ArrowRight /></el-icon>
            </el-button>
          </div>
          <el-table :data="overview?.recentInstances || []" stripe>
            <el-table-column label="实例名" min-width="160">
              <template #default="{ row }">
                <div style="display:flex;align-items:center;gap:8px">
                  <el-avatar :size="26" shape="square" style="background:#ecf2ff;color:#2b6bff">💠</el-avatar>
                  <div>
                    <div style="font-weight:600">{{ row.name }}</div>
                    <div style="font-size:12px;color:var(--gd-text-3)">{{ row.image }}</div>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="gpu" label="GPU" min-width="130" />
            <el-table-column label="地域" width="110">
              <template #default="{ row }">
                <span>📍 {{ row.region }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <span :class="'status-' + row.status"><i class="status-dot"></i>{{ statusText[row.status] }}</span>
              </template>
            </el-table-column>
            <el-table-column label="费用/小时" width="100">
              <template #default="{ row }"><b>¥ {{ row.costPerHour.toFixed(2) }}</b></template>
            </el-table-column>
            <el-table-column prop="createdAt" label="创建时间" width="140" />
            <el-table-column width="60" align="center">
              <template #default><el-icon style="cursor:pointer"><MoreFilled /></el-icon></template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>

      <!-- ===== 右侧栏 ===== -->
      <el-col :span="6">
        <!-- 快捷操作 -->
        <div class="gd-card" style="margin-bottom: 16px">
          <div class="gd-card-title"><span>快捷操作</span></div>
          <div class="quick-action" @click="$router.push('/create')">
            <div class="qa-icon" style="background:linear-gradient(135deg,#2b6bff,#6d3bff)"><el-icon><Plus /></el-icon></div>
            <div><div class="qa-title">创建实例</div><div class="qa-desc">快速部署 GPU 实例</div></div>
          </div>
          <div class="quick-action" @click="$router.push('/billing')">
            <div class="qa-icon" style="background:linear-gradient(135deg,#10b981,#059669)"><el-icon><Wallet /></el-icon></div>
            <div><div class="qa-title">充值</div><div class="qa-desc">为账户充值</div></div>
          </div>
          <div class="quick-action" @click="$router.push('/monitor')">
            <div class="qa-icon" style="background:linear-gradient(135deg,#f59e0b,#d97706)"><el-icon><DataLine /></el-icon></div>
            <div><div class="qa-title">查看监控</div><div class="qa-desc">实时资源监控</div></div>
          </div>
          <div class="quick-action" @click="openJupyter">
            <div class="qa-icon" style="background:linear-gradient(135deg,#f97316,#ea580c)"><el-icon><Notebook /></el-icon></div>
            <div><div class="qa-title">打开 Jupyter</div><div class="qa-desc">在线开发与调试</div></div>
          </div>
        </div>

        <!-- 平台公告 -->
        <div class="gd-card" style="margin-bottom: 16px">
          <div class="gd-card-title">
            <span>平台公告</span>
            <el-button text type="primary" size="small">查看全部</el-button>
          </div>
          <div v-for="a in overview?.announcements || []" :key="a.id" style="display:flex;gap:10px;margin-bottom:14px">
            <div style="font-size:18px">{{ a.type === 'new' ? '📣' : a.type === 'maintain' ? '🛠️' : '🎁' }}</div>
            <div style="flex:1">
              <div style="font-weight:600;font-size:13px">{{ a.title }}</div>
              <div style="font-size:12px;color:var(--gd-text-3);margin-top:2px;line-height:1.5">{{ a.content }}</div>
            </div>
            <div style="font-size:12px;color:var(--gd-text-3);white-space:nowrap">{{ a.date.slice(5) }}</div>
          </div>
        </div>

        <!-- 资源配额 -->
        <div class="gd-card">
          <div class="gd-card-title"><span>资源配额</span></div>
          <div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
              <span>GPU 配额</span><span style="color:var(--gd-text-2)">{{ account.gpuUsed }} / {{ account.gpuTotal }} 张</span>
            </div>
            <el-progress :percentage="Math.round(account.gpuUsed / account.gpuTotal * 100)" :stroke-width="8" color="#2b6bff" />
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
              <span>存储空间</span><span style="color:var(--gd-text-2)">1.2 TB / 5 TB</span>
            </div>
            <el-progress :percentage="24" :stroke-width="8" color="#10b981" />
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue';
import * as echarts from 'echarts';
import { getOverview } from '../api';
import { ElMessage } from 'element-plus';

const overview = ref(null);
const range = ref(7);
const costChartRef = ref();
const gpuChartRef = ref();
const statusChartRef = ref();
let charts = [];

const now = new Date('2026-04-24');
const today = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
const weekday = '三';

const statusText = { running: '运行中', starting: '启动中', stopped: '已停止', error: '异常' };

const account = computed(() => overview.value?.account || {});
const stats = computed(() => {
  const a = overview.value?.account;
  if (!a) return [];
  return [
    { label: '运行中实例', value: a.runningInstances, icon: '🗂️', bg: '#ecf2ff', sub: `总计 ${a.totalInstances} 个实例`, delta: 0.29 },
    { label: 'GPU 使用率', value: Math.round(a.gpuUsed / a.gpuTotal * 100) + '%', icon: '🖥️', bg: '#ecfdf5', sub: `已使用 ${a.gpuUsed} / ${a.gpuTotal} 张`, delta: 0.12 },
    { label: '今日费用', value: '¥ ' + a.todayCost.toFixed(2), icon: '💳', bg: '#eff6ff', sub: '较昨日 - 18%', delta: -0.18 },
    { label: '账户余额', value: '¥ ' + a.balance.toFixed(2), icon: '💰', bg: '#fffbeb', sub: `预计可用 ${a.quotaExpireDays} 天`, delta: 0 },
  ];
});

function drawCharts() {
  if (!overview.value) return;
  charts.forEach((c) => c.dispose());
  charts = [];

  // 费用趋势
  const costChart = echarts.init(costChartRef.value);
  const cost = overview.value.costTrend;
  costChart.setOption({
    grid: { left: 46, right: 16, top: 30, bottom: 26 },
    tooltip: { trigger: 'axis', valueFormatter: (v) => '¥ ' + v },
    xAxis: { type: 'category', data: cost.map((d) => d.date), axisLine: { lineStyle: { color: '#e8ecf2' } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0f3f8' } } },
    series: [{
      type: 'line', data: cost.map((d) => d.cost), smooth: true, symbol: 'circle', symbolSize: 7,
      lineStyle: { color: '#2b6bff', width: 2.5 },
      itemStyle: { color: '#2b6bff' },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: 'rgba(43,107,255,0.22)' }, { offset: 1, color: 'rgba(43,107,255,0)' },
      ]) },
      markPoint: {
        data: [{ type: 'max', name: '峰值' }], symbolSize: 52,
        itemStyle: { color: '#2b6bff' },
        label: { formatter: (p) => '¥ ' + p.value, fontSize: 10, color: '#fff' },
      },
    }],
  });
  charts.push(costChart);

  // GPU 使用趋势（堆叠面积）
  const gpuChart = echarts.init(gpuChartRef.value);
  const usage = overview.value.gpuUsageTrend;
  gpuChart.setOption({
    grid: { left: 34, right: 10, top: 36, bottom: 26 },
    tooltip: { trigger: 'axis' },
    legend: { top: 0, right: 0, itemWidth: 10, textStyle: { fontSize: 11, color: '#6b7280' } },
    xAxis: { type: 'category', data: usage.map((d) => d.date), axisLine: { lineStyle: { color: '#e8ecf2' } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0f3f8' } } },
    series: [
      { name: '计算中', type: 'line', stack: 'total', data: usage.map((d) => d.computing), smooth: true, symbol: 'none', areaStyle: { opacity: 0.85 }, lineStyle: { width: 0 }, itemStyle: { color: '#2b6bff' } },
      { name: '空闲', type: 'line', stack: 'total', data: usage.map((d) => d.idle), smooth: true, symbol: 'none', areaStyle: { opacity: 0.85 }, lineStyle: { width: 0 }, itemStyle: { color: '#10b981' } },
      { name: '其他', type: 'line', stack: 'total', data: usage.map((d) => d.other), smooth: true, symbol: 'none', areaStyle: { opacity: 0.85 }, lineStyle: { width: 0 }, itemStyle: { color: '#a78bfa' } },
    ],
  });
  charts.push(gpuChart);

  // 状态分布环形图
  const statusChart = echarts.init(statusChartRef.value);
  const dist = overview.value.statusDist;
  statusChart.setOption({
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', right: 0, top: 'center', itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 12, color: '#6b7280' },
      formatter: (name) => {
        const map = { '运行中': dist.running, '启动中': dist.starting, '已停止': dist.stopped, '异常': dist.error };
        const total = dist.running + dist.starting + dist.stopped + dist.error;
        return `${name}  ${map[name]}  ${((map[name] / total) * 100).toFixed(1)}%`;
      } },
    series: [{
      type: 'pie', radius: ['58%', '80%'], center: ['35%', '50%'],
      label: {
        show: true, position: 'center', formatter: () => `{a|${dist.running + dist.starting + dist.stopped + dist.error}}\n{b|总实例数}`,
        rich: { a: { fontSize: 26, fontWeight: 700, color: '#1f2937' }, b: { fontSize: 12, color: '#9ca3af', padding: [4, 0, 0, 0] } },
      },
      data: [
        { value: dist.running, name: '运行中', itemStyle: { color: '#10b981' } },
        { value: dist.starting, name: '启动中', itemStyle: { color: '#3b82f6' } },
        { value: dist.stopped, name: '已停止', itemStyle: { color: '#d1d5db' } },
        { value: dist.error, name: '异常', itemStyle: { color: '#ef4444' } },
      ],
    }],
  });
  charts.push(statusChart);
}

async function load() {
  overview.value = await getOverview(range.value);
  await nextTick();
  drawCharts();
}

function openJupyter() {
  ElMessage.info('正在为新标签页打开 JupyterLab…（演示）');
}

function onResize() { charts.forEach((c) => c.resize()); }

onMounted(() => {
  load();
  window.addEventListener('resize', onResize);
});
onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  charts.forEach((c) => c.dispose());
});
</script>
