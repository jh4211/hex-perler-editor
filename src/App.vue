<template>
  <div id="app">
    <el-container>
      <el-header>
        <h1>圆形拼豆编辑器</h1>
        <p class="subtitle">拼豆图纸工具 @mizukikoo</p>
      </el-header>
      <el-main>
        <HexPerlerCanvas ref="canvasRef" />
      </el-main>
      <!-- <el-footer>
        <span>© 2026 拼豆画布编辑器 v1.0</span>
      </el-footer> -->
    </el-container>
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import HexPerlerCanvas from "@/components/HexPerlerCanvas.vue";
const canvasRef = ref<InstanceType<typeof HexPerlerCanvas>>();
</script>
<style>
#app {
  height: 100vh;
  margin: 0;
  padding: 0;
}
.el-container {
  height: 100%;
}
.el-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 20px;
  text-align: center;
}
.el-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}
.el-header .subtitle {
  margin: 4px 0 0 0;
  opacity: 0.8;
  font-size: 14px;
}
.el-main {
  padding: 0px !important;
  background: #f0f2f5;
  overflow-y: auto;
}
.el-footer {
  background: #f5f7fa;
  text-align: center;
  padding: 12px;
  font-size: 12px;
  color: #909399;
  border-top: 1px solid #dcdfe6;
}
</style>
