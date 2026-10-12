<template>
  <div>
    <div class="page-welcome">
      <h2>费用中心</h2>
      <p>充值、消费明细与用量统计</p>
    </div>

    <el-row :gutter="16" style="margin-bottom:16px">
      <el-col :span="8">
        <div class="gd-card">
          <div class="stat-card">
            <div class="stat-icon" style="background:#fffbeb">💰</div>
            <div class="stat-info">
              <div class="stat-label">账户余额</div>
              <div class="stat-value">¥ {{ billing.balance?.toFixed(2) }}</div>
              <div class="stat-sub">预计可用 42 天</div>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :span="16">
        <div class="gd-card">
          <div class="gd-card-title"><span>最近消费趋势</span></div>
          <div ref="chartRef" style="height:120px"></div>
        </div>
      </el-col>
    </el-row>

    <div class="gd-card">
      <div class="gd-card-title">
        <span>消费明细</span>
        <el-button type="primary" @click="recharge">充值</el-button>
      </div>
      <el-table :data="billing.records || []" stripe>
        <el-table-column prop="date" label="日期" width="140" />
        <el-table-column prop="type" label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="row.amount.startsWith('+') ? 'success' : 'info'" size="small">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="desc" label="说明" min-width="220" />
        <el-table-column label="金额" width="140" align="right">
          <template #default="{ row }">
            <b :style="{ color: row.amount.startsWith('+') ? 'var(--gd-success)' : 'var(--gd-text)' }">{{ row.amount }}</b>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import { getBilling, getOverview } from '../api';
import { ElMessage } from 'element-plus';

const billing = ref({});
const chartRef = ref();
let chart;

async function recharge() { ElMessage.info('演示环境：请对接支付网关后启用充值'); }

onMounted(async () => {
  billing.value = await getBilling();
  const ov = await getOverview(7);
  chart = echarts.init(chartRef.value);
  chart.setOption({
    grid: { left: 46, right: 12, top: 10, bottom: 22 },
    xAxis: { type: 'category', data: ov.costTrend.map((d) => d.date), axisLabel: { fontSize: 10 }, axisLine: { lineStyle: { color: '#e8ecf2' } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0f3f8' } }, axisLabel: { fontSize: 10 } },
    series: [{ type: 'bar', data: ov.costTrend.map((d) => d.cost), itemStyle: { color: '#2b6bff', borderRadius: [4, 4, 0, 0] }, barWidth: '45%' }],
  });
  window.addEventListener('resize', () => chart?.resize());
});
onUnmounted(() => chart?.dispose());
</script>
