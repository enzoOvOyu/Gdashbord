<template>
  <div>
    <div class="page-welcome">
      <h2>GPU 算力市场</h2>
      <p>实时比价 · 供需定价 · 秒级开通 —— 筛选最适合你的 GPU</p>
    </div>

    <!-- 筛选栏（参考 Vast.ai） -->
    <div class="gd-card" style="margin-bottom:16px">
      <el-form inline style="margin-bottom:0">
        <el-form-item label="GPU 型号">
          <el-select v-model="filters.gpu" placeholder="全部型号" clearable style="width:160px">
            <el-option v-for="g in gpuOptions" :key="g" :label="g" :value="g" />
          </el-select>
        </el-form-item>
        <el-form-item label="最低显存">
          <el-select v-model="filters.minVram" placeholder="不限" clearable style="width:120px">
            <el-option label="16 GB" :value="16" />
            <el-option label="24 GB" :value="24" />
            <el-option label="48 GB" :value="48" />
            <el-option label="80 GB" :value="80" />
          </el-select>
        </el-form-item>
        <el-form-item label="最高单价">
          <el-input-number v-model="filters.maxPrice" :min="0.5" :max="10" :step="0.5" controls-position="right" style="width:120px" />
          <span style="margin-left:6px;color:var(--gd-text-3)">¥/时</span>
        </el-form-item>
        <el-form-item label="地域">
          <el-select v-model="filters.region" placeholder="全部地域" clearable style="width:140px">
            <el-option v-for="r in regions" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>
        <el-form-item label="云类型">
          <el-radio-group v-model="filters.cloudType">
            <el-radio-button value="all">全部</el-radio-button>
            <el-radio-button value="secure">安全云</el-radio-button>
            <el-radio-button value="community">社区云</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="排序">
          <el-select v-model="filters.sort" style="width:170px">
            <el-option label="性价比优先 (DLPerf/¥)" value="value" />
            <el-option label="价格从低到高" value="price-asc" />
            <el-option label="价格从高到低" value="price-desc" />
            <el-option label="算力优先 (DLPerf)" value="dlperf-desc" />
            <el-option label="显存优先" value="vram-desc" />
          </el-select>
        </el-form-item>
      </el-form>
    </div>

    <!-- GPU 卡片列表（参考 RunPod） -->
    <el-row :gutter="16">
      <el-col :span="8" v-for="g in gpus" :key="g.id" style="margin-bottom:16px">
        <div class="gd-card gpu-card" @click="$router.push({ path: '/create', query: { gpu: g.id } })">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div>
              <div style="font-size:16px;font-weight:700">NVIDIA {{ g.name }}</div>
              <div style="font-size:12px;color:var(--gd-text-3);margin-top:2px">{{ g.arch }} · CUDA {{ g.cuda }}</div>
            </div>
            <el-tag :type="g.cloudType === 'secure' ? 'success' : g.cloudType === 'community' ? 'warning' : 'info'" size="small">
              {{ g.cloudType === 'secure' ? '安全云' : g.cloudType === 'community' ? '社区云' : '双可用' }}
            </el-tag>
          </div>
          <div style="display:flex;gap:18px;margin-bottom:14px">
            <div>
              <div style="font-size:12px;color:var(--gd-text-3)">显存</div>
              <div style="font-weight:600">{{ g.vram }} GB</div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--gd-text-3)">DLPerf 算力</div>
              <div style="font-weight:600">{{ g.tflops }}</div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--gd-text-3)">库存</div>
              <div style="font-weight:600">{{ g.stock }} 卡</div>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--gd-border);padding-top:12px">
            <div>
              <span style="font-size:20px;font-weight:700;color:var(--gd-primary)">¥{{ g.price.toFixed(2) }}</span>
              <span style="color:var(--gd-text-3);font-size:12px">/时</span>
              <span style="font-size:12px;color:var(--gd-success);margin-left:8px">会员 ¥{{ g.memberPrice.toFixed(2) }}</span>
            </div>
            <el-button type="primary" size="small" round>立即租用</el-button>
          </div>
          <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
            <el-tag v-for="r in g.regions" :key="r" size="small" type="info" effect="plain">{{ r }}</el-tag>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue';
import { getGpus, getRegions } from '../api';

const gpus = ref([]);
const regions = ref([]);
const gpuOptions = ['RTX 4090', 'RTX 5090', 'V100', 'A800-80GB', 'H800/80GB', 'H20/96GB', 'L40S', 'RTX 3090', 'RTX A4000', 'RTX 4090D'];
const filters = reactive({ gpu: '', minVram: null, maxPrice: null, region: '', cloudType: 'all', sort: 'value' });

async function load() {
  gpus.value = await getGpus({
    minVram: filters.minVram || undefined,
    maxPrice: filters.maxPrice || undefined,
    region: filters.region || undefined,
    cloudType: filters.cloudType,
    sort: filters.sort,
  });
}

watch(filters, load, { deep: true });
onMounted(async () => {
  regions.value = await getRegions();
  await load();
});
</script>
