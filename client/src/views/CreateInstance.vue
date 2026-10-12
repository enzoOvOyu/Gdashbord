<template>
  <div>
    <div class="page-welcome">
      <h2>创建 GPU 实例</h2>
      <p>参考 RunPod 部署流程：选 GPU → 选镜像 → 配磁盘 → 选计费 → 一键部署</p>
    </div>

    <el-steps :active="step" align-center style="margin-bottom:24px;background:#fff;border-radius:12px;padding:18px 0;border:1px solid var(--gd-border)">
      <el-step title="选择 GPU" description="型号 / 数量 / 地域" />
      <el-step title="选择镜像" description="框架 / AI 应用" />
      <el-step title="配置确认" description="磁盘 / 计费方式" />
    </el-steps>

    <!-- Step 1: GPU -->
    <div v-show="step === 0" class="gd-card">
      <div class="gd-card-title"><span>1. 选择 GPU 型号与数量</span></div>
      <el-row :gutter="14">
        <el-col :span="6" v-for="g in gpus" :key="g.id" style="margin-bottom:14px">
          <div class="gd-card gpu-card" :class="{ selected: form.gpuId === g.id }" style="padding:14px"
               @click="form.gpuId = g.id; form.region = g.regions[0]">
            <div style="font-weight:700">NVIDIA {{ g.name }}</div>
            <div style="font-size:12px;color:var(--gd-text-3);margin:4px 0 8px">{{ g.vram }} GB 显存 · {{ g.tflops }}</div>
            <div style="color:var(--gd-primary);font-weight:700">¥{{ g.price.toFixed(2) }}<span style="font-size:12px;color:var(--gd-text-3)">/时/卡</span></div>
          </div>
        </el-col>
      </el-row>
      <el-divider />
      <el-form label-width="90px" style="max-width:560px">
        <el-form-item label="GPU 数量">
          <el-input-number v-model="form.gpuCount" :min="1" :max="8" />
        </el-form-item>
        <el-form-item label="地域">
          <el-select v-model="form.region" style="width:220px">
            <el-option v-for="r in availableRegions" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :disabled="!form.gpuId" @click="step = 1">下一步</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- Step 2: 镜像 -->
    <div v-show="step === 1" class="gd-card">
      <div class="gd-card-title"><span>2. 选择实例镜像（一键部署 AI 应用）</span></div>
      <el-row :gutter="14">
        <el-col :span="8" v-for="img in images" :key="img.id" style="margin-bottom:14px">
          <div class="gd-card gpu-card" :class="{ selected: form.image === img.name }" style="padding:14px" @click="form.image = img.name">
            <div style="display:flex;gap:10px;align-items:center">
              <div style="font-size:24px">{{ img.icon }}</div>
              <div>
                <div style="font-weight:600">{{ img.name }}</div>
                <div style="font-size:12px;color:var(--gd-text-3)">{{ img.size }} · {{ img.downloads.toLocaleString() }} 次使用</div>
              </div>
            </div>
            <div style="font-size:12px;color:var(--gd-text-2);margin-top:8px">{{ img.desc }}</div>
          </div>
        </el-col>
      </el-row>
      <el-divider />
      <el-form label-width="90px" style="max-width:560px">
        <el-form-item label="实例名称">
          <el-input v-model="form.name" placeholder="例如 nlp-train-002" />
        </el-form-item>
        <el-form-item>
          <el-button @click="step = 0">上一步</el-button>
          <el-button type="primary" @click="step = 2">下一步</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- Step 3: 确认 -->
    <div v-show="step === 2" class="gd-card" style="max-width:720px">
      <div class="gd-card-title"><span>3. 配置确认</span></div>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="实例名称">{{ form.name || 'new-instance' }}</el-descriptions-item>
        <el-descriptions-item label="GPU">NVIDIA {{ selectedGpu?.name }} × {{ form.gpuCount }}</el-descriptions-item>
        <el-descriptions-item label="地域">{{ form.region }}</el-descriptions-item>
        <el-descriptions-item label="镜像">{{ form.image }}</el-descriptions-item>
        <el-descriptions-item label="数据盘大小">
          <el-input-number v-model="form.diskSize" :min="20" :max="2000" :step="10" /> GB
        </el-descriptions-item>
        <el-descriptions-item label="计费方式">
          <el-radio-group v-model="form.pricing">
            <el-radio value="on-demand">按量计费</el-radio>
            <el-radio value="spot">竞价实例（约 55% 价格）</el-radio>
          </el-radio-group>
        </el-descriptions-item>
      </el-descriptions>
      <el-alert type="info" :closable="false" style="margin:16px 0"
        :title="`预计费用：¥${estimated.toFixed(2)} / 小时（${form.pricing === 'spot' ? '竞价 55 折' : '按量原价'}）`" />
      <el-button @click="step = 1">上一步</el-button>
      <el-button type="primary" :loading="deploying" @click="deploy">🚀 立即部署</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getGpus, getImages, createInstance } from '../api';
import { ElMessage } from 'element-plus';

const route = useRoute();
const router = useRouter();
const step = ref(0);
const gpus = ref([]);
const images = ref([]);
const deploying = ref(false);

const form = reactive({
  gpuId: route.query.gpu || '',
  gpuCount: 1,
  region: '',
  image: 'PyTorch 2.4 + CUDA 12.4',
  name: '',
  diskSize: 50,
  pricing: 'on-demand',
});

const selectedGpu = computed(() => gpus.value.find((g) => g.id === form.gpuId));
const availableRegions = computed(() => selectedGpu.value?.regions || []);
const estimated = computed(() => {
  if (!selectedGpu.value) return 0;
  return selectedGpu.value.price * form.gpuCount * (form.pricing === 'spot' ? 0.55 : 1);
});

async function deploy() {
  deploying.value = true;
  try {
    await createInstance({ ...form });
    ElMessage.success('实例部署中！已跳转到实例管理');
    router.push('/instances');
  } finally {
    deploying.value = false;
  }
}

onMounted(async () => {
  gpus.value = await getGpus({});
  images.value = await getImages('全部');
  if (form.gpuId) form.region = gpus.value.find((g) => g.id === form.gpuId)?.regions[0] || '';
});
</script>
