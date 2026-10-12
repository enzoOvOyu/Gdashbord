<template>
  <div>
    <div class="page-welcome">
      <h2>监控中心</h2>
      <p>参考 Modal 开发者体验：细粒度实时指标 + 流式日志</p>
    </div>

    <el-row :gutter="16">
      <el-col :span="6">
        <div class="gd-card" style="padding:10px">
          <div v-for="inst in instances" :key="inst.id"
               class="inst-item" :class="{ active: current?.id === inst.id }"
               @click="select(inst)">
            <div style="display:flex;align-items:center;gap:8px">
              <span :class="'status-' + inst.status"><i class="status-dot"></i></span>
              <div>
                <div style="font-weight:600;font-size:13px">{{ inst.name }}</div>
                <div style="font-size:11px;color:var(--gd-text-3)">{{ inst.gpu }}</div>
              </div>
            </div>
          </div>
        </div>
      </el-col>

      <el-col :span="18">
        <el-row :gutter="16">
          <el-col :span="12">
            <div class="gd-card" style="margin-bottom:16px">
              <div class="gd-card-title"><span>GPU 利用率 (%)</span><el-tag size="small" type="success" effect="plain">实时 · 5s</el-tag></div>
              <div ref="gpuChartRef" style="height:200px"></div>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="gd-card" style="margin-bottom:16px">
              <div class="gd-card-title"><span>显存占用 (%)</span></div>
              <div ref="vramChartRef" style="height:200px"></div>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="gd-card" style="margin-bottom:16px">
              <div class="gd-card-title"><span>整机功耗 (W)</span></div>
              <div ref="powerChartRef" style="height:200px"></div>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="gd-card" style="margin-bottom:16px">
              <div class="gd-card-title"><span>网络吞吐 (MB/s)</span></div>
              <div ref="netChartRef" style="height:200px"></div>
            </div>
          </el-col>
        </el-row>

        <div class="gd-card">
          <div class="gd-card-title">
            <span>实例日志</span>
            <div style="display:flex;gap:10px;align-items:center">
              <el-switch v-model="autoScroll" active-text="自动滚动" size="small" />
              <el-button size="small" @click="loadLogs">刷新</el-button>
            </div>
          </div>
          <div ref="logBox" class="log-box">
            <div v-for="(line, i) in logs" :key="i" class="log-line">
              <span class="log-ts">{{ line.ts }}</span>
              <span :class="line.text.startsWith('[ERROR]') ? 'log-err' : line.text.startsWith('[WARN]') ? 'log-warn' : 'log-info'">{{ line.text }}</span>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import * as echarts from 'echarts';
import { getInstances, getInstanceMetrics, getInstanceLogs } from '../api';

const instances = ref([]);
const current = ref(null);
const logs = ref([]);
const autoScroll = ref(true);
const gpuChartRef = ref(); const vramChartRef = ref();
const powerChartRef = ref(); const netChartRef = ref(); const logBox = ref();
let charts = {}; let timer1; let timer2;

const chartDefs = [
  { key: 'gpu', ref: 'gpuChartRef', field: 'gpuUtil', color: '#2b6bff' },
  { key: 'vram', ref: 'vramChartRef', field: 'vram', color: '#10b981' },
  { key: 'power', ref: 'powerChartRef', field: 'power', color: '#f59e0b' },
  { key: 'net', ref: 'netChartRef', field: 'network', color: '#a78bfa' },
];

function drawLine(chart, data, field, color) {
  chart.setOption({
    grid: { left: 40, right: 12, top: 12, bottom: 24 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: data.map((d) => d.time), axisLabel: { fontSize: 10, interval: 9 }, axisLine: { lineStyle: { color: '#e8ecf2' } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0f3f8' } }, axisLabel: { fontSize: 10 } },
    series: [{ type: 'line', data: data.map((d) => d[field]), smooth: true, symbol: 'none',
      lineStyle: { color, width: 2 },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: color + '33' }, { offset: 1, color: color + '00' },
      ]) } }],
  });
}

async function select(inst) {
  current.value = inst;
  await refresh();
}

async function refresh() {
  if (!current.value) return;
  const data = await getInstanceMetrics(current.value.id);
  for (const def of chartDefs) {
    if (!charts[def.key]) charts[def.key] = echarts.init(def.ref.value);
    drawLine(charts[def.key], data, def.field, def.color);
  }
}

async function loadLogs() {
  if (!current.value) return;
  logs.value = await getInstanceLogs(current.value.id);
  await nextTick();
  if (autoScroll.value && logBox.value) logBox.value.scrollTop = logBox.value.scrollHeight;
}

onMounted(async () => {
  instances.value = await getInstances();
  const running = instances.value.find((i) => i.status === 'running') || instances.value[0];
  if (running) await select(running);
  timer1 = setInterval(refresh, 5000);
  timer2 = setInterval(loadLogs, 8000);
});
onUnmounted(() => { clearInterval(timer1); clearInterval(timer2); Object.values(charts).forEach((c) => c.dispose()); });
</script>

<style scoped>
.inst-item { padding: 12px; border-radius: 8px; cursor: pointer; margin-bottom: 4px; border: 1px solid transparent; }
.inst-item:hover { background: #f3f6fc; }
.inst-item.active { background: var(--gd-primary-light); border-color: var(--gd-primary); }

.log-box {
  height: 300px; overflow-y: auto; background: #0f172a; border-radius: 10px;
  padding: 14px 16px; font-family: 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace; font-size: 12px;
}
.log-line { line-height: 1.9; white-space: nowrap; }
.log-ts { color: #64748b; margin-right: 12px; }
.log-info { color: #cbd5e1; }
.log-warn { color: #fbbf24; }
.log-err { color: #f87171; }
</style>
