<template>
  <div>
    <div class="page-welcome">
      <h2>实例管理</h2>
      <p>参考 AutoDL 实例控制台：状态一目了然，支持无卡模式、保存镜像、快速连接</p>
    </div>

    <div class="gd-card">
      <div style="display:flex;justify-content:space-between;margin-bottom:16px">
        <div style="display:flex;gap:10px">
          <el-input v-model="keyword" placeholder="搜索实例名称" style="width:240px" clearable>
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-select v-model="statusFilter" style="width:130px" clearable placeholder="全部状态">
            <el-option label="运行中" value="running" />
            <el-option label="启动中" value="starting" />
            <el-option label="已停止" value="stopped" />
            <el-option label="异常" value="error" />
          </el-select>
        </div>
        <el-button type="primary" @click="$router.push('/create')">
          <el-icon><Plus /></el-icon>&nbsp;创建实例
        </el-button>
      </div>

      <el-table :data="filtered" stripe row-key="id">
        <el-table-column label="实例名称" min-width="180">
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
        <el-table-column prop="gpu" label="GPU" min-width="140" />
        <el-table-column label="地域" width="110">
          <template #default="{ row }">{{ row.region }}</template>
        </el-table-column>
        <el-table-column label="存储" width="130">
          <template #default="{ row }">
            <el-progress :percentage="Math.round(row.disk.used / row.disk.total * 100)" :stroke-width="6"
              :color="row.disk.used / row.disk.total > 0.8 ? '#ef4444' : '#2b6bff'" />
            <div style="font-size:11px;color:var(--gd-text-3)">{{ row.disk.used }}G / {{ row.disk.total }}G</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span :class="'status-' + row.status"><i class="status-dot"></i>{{ statusText[row.status] }}</span>
          </template>
        </el-table-column>
        <el-table-column label="费用/小时" width="100">
          <template #default="{ row }"><b>¥ {{ row.costPerHour.toFixed(2) }}</b></template>
        </el-table-column>
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link :disabled="row.status === 'running'" @click="act(row, 'start')">开机</el-button>
            <el-button size="small" type="warning" link :disabled="row.status === 'stopped'" @click="act(row, 'stop')">关机</el-button>
            <el-button size="small" link @click="act(row, 'start-no-gpu')" :disabled="row.mode === 'no-gpu'">无卡模式</el-button>
            <el-button size="small" type="success" link @click="connect(row)">连接</el-button>
            <el-dropdown trigger="click" @command="(cmd) => more(row, cmd)" style="margin-left:8px">
              <el-button size="small" link>更多<el-icon><ArrowDown /></el-icon></el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="monitor">查看监控</el-dropdown-item>
                  <el-dropdown-item command="saveImage">保存镜像</el-dropdown-item>
                  <el-dropdown-item command="restart">重启实例</el-dropdown-item>
                  <el-dropdown-item command="terminate" divided style="color:var(--gd-danger)">释放实例</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 连接弹窗（JupyterLab / SSH） -->
    <el-dialog v-model="connectVisible" :title="`连接实例 - ${current?.name}`" width="560px">
      <el-tabs>
        <el-tab-pane label="JupyterLab">
          <p style="color:var(--gd-text-2)">在线 Notebook 开发环境，适合快速调试与可视化。</p>
          <el-button type="primary" @click="openJupyter">打开 JupyterLab ↗</el-button>
        </el-tab-pane>
        <el-tab-pane label="SSH 登录">
          <p style="color:var(--gd-text-2)">复制以下登录指令，在本机终端执行：</p>
          <el-input :model-value="sshCmd" readonly>
            <template #append>
              <el-button @click="copy(sshCmd)">复制</el-button>
            </template>
          </el-input>
        </el-tab-pane>
        <el-tab-pane label="VSCode Remote">
          <p style="color:var(--gd-text-2)">使用 VSCode Remote-SSH 扩展连接，获得完整 IDE 体验。</p>
          <code style="background:#f5f7fa;padding:8px 12px;border-radius:8px;display:block">{{ sshCmd }}</code>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { getInstances, instanceAction } from '../api';
import { ElMessage, ElMessageBox } from 'element-plus';

const instances = ref([]);
const keyword = ref('');
const statusFilter = ref('');
const connectVisible = ref(false);
const current = ref(null);
const statusText = { running: '运行中', starting: '启动中', stopped: '已停止', error: '异常' };
let timer;

const filtered = computed(() =>
  instances.value.filter((i) =>
    (!keyword.value || i.name.includes(keyword.value)) &&
    (!statusFilter.value || i.status === statusFilter.value)
  )
);

const sshCmd = computed(() => current.value
  ? `ssh -p ${30000 + parseInt(current.value.id.slice(-3))} root@ssh.yunsuanli.cloud`
  : '');

async function load() { instances.value = await getInstances(); }

async function act(row, action) {
  const r = await instanceAction(row.id, action);
  ElMessage.success(r.message || '操作成功，状态更新中');
  load();
}

function connect(row) { current.value = row; connectVisible.value = true; }
function openJupyter() { ElMessage.info('正在打开 JupyterLab…（演示）'); }

async function more(row, cmd) {
  if (cmd === 'monitor') return;
  if (cmd === 'terminate') {
    await ElMessageBox.confirm(`释放后实例 ${row.name} 的所有数据将丢失且不可恢复！确定释放？`, '危险操作', { type: 'warning' });
  }
  if (cmd === 'saveImage') return ElMessage.info('镜像保存任务已提交（关机状态下方可保存）');
  await act(row, cmd);
}

function copy(text) {
  navigator.clipboard.writeText(text);
  ElMessage.success('已复制');
}

onMounted(() => { load(); timer = setInterval(load, 5000); });
onUnmounted(() => clearInterval(timer));
</script>
