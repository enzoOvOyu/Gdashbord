<template>
  <div>
    <div class="page-welcome">
      <h2>镜像商城</h2>
      <p>参考优云智算：精选 AI 镜像与应用，一键部署开箱即用</p>
    </div>

    <el-tabs v-model="category" @tab-change="load" style="margin-bottom:4px">
      <el-tab-pane v-for="c in categories" :key="c" :label="c" :name="c" />
    </el-tabs>

    <el-row :gutter="16">
      <el-col :span="6" v-for="img in images" :key="img.id" style="margin-bottom:16px">
        <div class="gd-card gpu-card" style="height:100%">
          <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">
            <div style="font-size:34px">{{ img.icon }}</div>
            <div>
              <div style="font-weight:700">{{ img.name }}</div>
              <div style="font-size:12px;color:var(--gd-text-3);margin-top:2px">{{ img.category }} · {{ img.size }}</div>
            </div>
          </div>
          <div style="font-size:13px;color:var(--gd-text-2);line-height:1.6;margin-bottom:12px;min-height:42px">{{ img.desc }}</div>
          <div style="display:flex;gap:6px;margin-bottom:12px">
            <el-tag v-for="t in img.tags" :key="t" size="small" effect="plain" type="primary">{{ t }}</el-tag>
            <span style="margin-left:auto;font-size:12px;color:var(--gd-text-3)">⬇ {{ img.downloads.toLocaleString() }}</span>
          </div>
          <el-button type="primary" round style="width:100%" @click="deploy(img)">一键部署</el-button>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getImages } from '../api';
import { ElMessage } from 'element-plus';

const router = useRouter();
const images = ref([]);
const category = ref('全部');
const categories = ['全部', '框架', '大模型', 'AI 应用', '工具'];

async function load() {
  images.value = await getImages(category.value);
}

function deploy(img) {
  ElMessage.success(`已选择镜像「${img.name}」，正在进入创建实例…`);
  router.push('/create');
}

onMounted(load);
</script>
