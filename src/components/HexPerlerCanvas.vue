<template>
  <div style="display: flex; gap: 16px; padding: 12px">
    <div style="width: 260px; display: flex; flex-direction: column; gap: 10px">
      <div>
        <div>画布圈数选择（10-26）</div>
        <el-input-number
          v-model="ringInput"
          :min="10"
          :max="26"
          :step="1"
          style="margin-top: 6px"
          @change="onRingChange"
        />
      </div>

      <div>
        <div>工具选择</div>
        <div>
          <el-button-group style="margin-top: 6px">
            <!--画笔-->
            <el-tooltip content="画笔" effect="light" placement="top">
              <el-button
                :type="currentTool === 'brush' ? 'primary' : ''"
                @click="setTool('brush')"
              >
                <Pencil size="18" />
              </el-button>
            </el-tooltip>

            <!--橡皮-->
            <el-tooltip content="橡皮" effect="light" placement="top">
              <el-button
                :type="currentTool === 'eraser' ? 'primary' : ''"
                @click="setTool('eraser')"
              >
                <Eraser size="18" />
              </el-button>
            </el-tooltip>

            <!--取色器-->
            <el-tooltip content="取色" effect="light" placement="top">
              <el-button
                :type="currentTool === 'picker' ? 'primary' : ''"
                @click="setTool('picker')"
              >
                <Sip size="18" />
              </el-button>
            </el-tooltip>
            <!--拖拽查看-->
            <el-tooltip content="拖拽查看" effect="light" placement="top">
              <el-button
                :type="currentTool === 'hand' ? 'primary' : ''"
                @click="setTool('hand')"
              >
                <Hand size="18" />
              </el-button>
            </el-tooltip>
          </el-button-group>
        </div>
        <div>
          <el-button-group style="margin-top: 6px">
            <!--填充工具-->
            <el-tooltip content="填充" effect="light" placement="top">
              <el-button
                :type="currentTool === 'fill' ? 'primary' : ''"
                @click="setTool('fill')"
              >
                <Paint size="18" />
              </el-button>
            </el-tooltip>

            <!--画圈工具（外圈一键填充）-->
            <el-tooltip content="外圈填充" effect="light" placement="top">
              <el-button
                :type="currentTool === 'ringFill' ? 'primary' : ''"
                @click="setTool('ringFill')"
              >
                <CircleLine size="18" />
              </el-button>
            </el-tooltip>

            <!--批量替换-->
            <el-tooltip content="批量替换" effect="light" placement="top">
              <el-button
                :type="currentTool === 'batchReplace' ? 'primary' : ''"
                @click="batchReplaceDialogVisible = true"
              >
                <BatchReplace size="18" />
              </el-button>
            </el-tooltip>
            <!--批量清空-->
            <el-tooltip content="批量清空" effect="light" placement="top">
              <el-button
                :type="currentTool === 'batchClear' ? 'primary' : ''"
                @click="batchClearDialogVisible = true"
              >
                <BatchClear size="18" />
              </el-button>
            </el-tooltip>
          </el-button-group>
        </div>
        <div>
          <el-button-group style="margin-top: 6px">
            <!--撤销-->
            <el-tooltip content="撤销" effect="light" placement="top">
              <el-button :disabled="!canUndo" @click="onUndo">
                <ArrowGoBack size="18" />
              </el-button>
            </el-tooltip>
            <!--重做-->
            <el-tooltip content="重做" effect="light" placement="top">
              <el-button :disabled="!canRedo" @click="onRedo">
                <ArrowGoForward size="18" />
              </el-button>
            </el-tooltip>
            <!--清空画布-->
            <el-tooltip content="清空画布" effect="light" placement="top">
              <el-button @click="handleClear">
                <DeleteBin size="18" />
              </el-button>
            </el-tooltip>
          </el-button-group>
        </div>
      </div>
      <!-- ========== Element‑Plus 缩放滑块 ========== -->
      <div>
        <div>预览缩放</div>
        <el-slider
          v-model="manualScaleSlider"
          :min="0.5"
          :max="2.0"
          :step="0.05"
          show-input
          @input="handleScaleSlider"
        />
      </div>
      <div>
        <div>网格显示选项</div>
        <div
          style="display: flex; align-items: center; gap: 8px; margin-top: 6px"
        >
          <el-switch v-model="showRingGrid" @change="renderCanvas" />
          <span>显示圆环网格</span>
        </div>
        <div
          style="display: flex; align-items: center; gap: 8px; margin-top: 6px"
        >
          <el-switch v-model="showRadialGuide" @change="renderCanvas" />
          <span>显示六等分辅助线</span>
        </div>
      </div>
      <div
        style="display: flex; align-items: center; gap: 8px; margin-top: 6px"
      >
        <el-switch v-model="showBeadText" @change="renderCanvas" />
        <span>预览显示豆子色号</span>
      </div>
      <div>
        <div
          style="
            display: flex;
            align-items: center;
            gap: 10px;
            justify-content: space-between;
          "
        >
          <div style="display: flex; align-items: center; gap: 8px">
            <div>调色板（MARD 221）</div>
            <div style="display: flex; align-items: center; gap: 4px">
              <div
                :style="{
                  width: '18px',
                  height: '18px',
                  borderRadius: '3px',
                  border: '1px solid #aaa',
                  backgroundColor: currentSelectColorItem?.hex ?? '#888888',
                }"
              ></div>
              <span style="font-size: 12px">{{
                currentSelectColorItem?.colorCode ?? "--"
              }}</span>
            </div>
          </div>

          <el-tooltip content="调色板窗口" effect="light">
            <el-button
              type="plain"
              text
              :icon="RiWindowLine"
              @click="paletteDialogVisible = true"
            ></el-button>
          </el-tooltip>
        </div>

        <el-scrollbar height="200px">
          <div
            style="
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 6px;
              margin-top: 6px;
            "
          >
            <div
              v-for="c in PERLER_BEAD_COLOR_LIBRARY"
              :key="c.colorCode"
              @click="setColor(c.hex)"
              class="color-item"
              :class="{ active: selectedColor === c.hex }"
            >
              <div class="color-code">{{ c.colorCode }}</div>
              <div
                class="color-block"
                :style="{ backgroundColor: c.hex }"
              ></div>
            </div>
          </div>
        </el-scrollbar>
      </div>

      <!-- <el-button class="long-button" @click="handleClear">清空画布</el-button> -->
      <el-button class="long-button" @click="openExportPngDialog"
        >导出PNG图纸</el-button
      >
      <el-button class="long-button" @click="handleExportJson"
        >导出JSON文件</el-button
      >
      <el-button class="long-button" @click="triggerImport"
        >导入JSON文件</el-button
      >
      <input
        ref="fileRef"
        type="file"
        accept=".json"
        @change="onFileImport"
        hidden
      />
    </div>

    <!-- 滚动画布容器 -->
    <div style="overflow: auto; border: 1px solid #666; max-height: 85vh">
      <canvas
        ref="canvasRef"
        :width="boardConfig.canvasWidth"
        :height="boardConfig.canvasHeight"
        :style="{
          cursor:
            currentTool === 'hand'
              ? isPanning
                ? 'grabbing'
                : 'grab'
              : 'crosshair',
          display: 'block',
        }"
        @mousedown="onCanvasMouseDown"
        @mousemove="onCanvasMouseMove"
        @mouseleave="stopDraw"
      ></canvas>
    </div>
    <!-- 导出PNG选项弹窗 -->
    <el-dialog
      v-model="exportPngDialogVisible"
      title="导出PNG图纸"
      width="460px"
    >
      <div style="display: flex; flex-direction: column; gap: 14px">
        <el-checkbox v-model="exportDrawBeadText"
          >导出图纸展示豆子色号名称</el-checkbox
        >

        <el-checkbox v-model="exportEnableWatermark"
          >启用水印（斜向平铺）</el-checkbox
        >
        <el-input
          v-model="exportWatermarkText"
          placeholder="请输入水印文字"
          :disabled="!exportEnableWatermark"
        />
      </div>
      <template #footer>
        <el-button @click="exportPngDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="doExportPng(exportDrawBeadText)"
          >确认导出</el-button
        >
      </template>
    </el-dialog>
    <el-dialog
      v-model="paletteDialogVisible"
      title="调色板（MARD 221）"
      width="530px"
      :modal="false"
      :modal-penetrable="true"
      draggable
      :close-on-click-modal="false"
      @opened="onPaletteDialogOpened"
      @closed="onPaletteDialogClosed"
    >
      <div style="height: 600px; overflow: hidden">
        <el-scrollbar height="100%">
          <div
            style="
              display: grid;
              grid-template-columns: repeat(10, 1fr);
              gap: 6px;
              margin-top: 6px;
            "
          >
            <div
              v-for="c in PERLER_BEAD_COLOR_LIBRARY"
              :key="c.colorCode"
              :ref="setItemRef"
              @click="setColor(c.hex)"
              class="color-item"
              :class="{ active: selectedColor === c.hex }"
            >
              <div class="color-code">{{ c.colorCode }}</div>
              <div
                class="color-block"
                :style="{ backgroundColor: c.hex }"
              ></div>
            </div>
          </div>
        </el-scrollbar>
      </div>
    </el-dialog>
    <!-- ========== 批量替换颜色弹窗 ========== -->
    <el-dialog
      v-model="batchReplaceDialogVisible"
      title="批量替换颜色"
      width="480px"
      :modal="false"
      modal-penetrable
      draggable
      :close-on-click-modal="false"
      @close="resetBatchDialogState"
    >
      <div style="display: flex; flex-direction: column; gap: 16px">
        <!-- 替换前 源颜色 -->
        <div>
          <div style="margin-bottom: 6px; font-weight: 500">
            替换前（源颜色）
          </div>
          <div style="display: flex; align-items: center; gap: 8px">
            <div
              :style="{
                width: '24px',
                height: '24px',
                borderRadius: '3px',
                border: '1px solid #aaa',
                backgroundColor:
                  getColorItemByHex(batchReplaceSourceHex)?.hex ?? '#888888',
              }"
            ></div>
            <span>{{
              getColorItemByHex(batchReplaceSourceHex)?.colorCode ?? "--"
            }}</span>
            <el-input
              v-model="batchReplaceSourceSearch"
              placeholder="输入色号如A01"
              size="small"
              @input="onReplaceSourceSearchInput"
              style="width: 140px"
            />
            <el-tooltip content="画布取色" effect="light">
              <el-button
                size="small"
                :icon="Sip"
                @click="pickMode = 'pickSource'"
              />
            </el-tooltip>
          </div>
        </div>

        <!-- 替换后 目标颜色 -->
        <div>
          <div style="margin-bottom: 6px; font-weight: 500">
            替换后（目标颜色）
          </div>
          <div style="display: flex; align-items: center; gap: 8px">
            <div
              :style="{
                width: '24px',
                height: '24px',
                borderRadius: '3px',
                border: '1px solid #aaa',
                backgroundColor:
                  getColorItemByHex(batchReplaceTargetHex)?.hex ?? '#888888',
              }"
            ></div>
            <span>{{
              getColorItemByHex(batchReplaceTargetHex)?.colorCode ?? "--"
            }}</span>
            <el-input
              v-model="batchReplaceTargetSearch"
              placeholder="输入色号如A02"
              size="small"
              @input="onReplaceTargetSearchInput"
              style="width: 140px"
            />
            <el-tooltip content="画布取色" effect="light">
              <el-button
                size="small"
                :icon="Sip"
                @click="pickMode = 'pickTarget'"
              />
            </el-tooltip>
          </div>
        </div>
        <div v-if="pickMode !== 'none'" style="color: #f56c6c">
          提示：请点击画布拾取颜色
        </div>
      </div>
      <template #footer>
        <el-button @click="resetBatchDialogState">取消</el-button>
        <el-button type="primary" @click="execBatchReplace">确认替换</el-button>
      </template>
    </el-dialog>

    <!-- ========== 批量清空弹窗 ========== -->
    <el-dialog
      v-model="batchClearDialogVisible"
      title="批量清空颜色"
      width="420px"
      :modal="false"
      modal-penetrable
      draggable
      :close-on-click-modal="false"
      @close="resetBatchDialogState"
    >
      <div style="display: flex; flex-direction: column; gap: 16px">
        <div>
          <div style="margin-bottom: 6px; font-weight: 500">待清空颜色</div>
          <div style="display: flex; align-items: center; gap: 8px">
            <div
              :style="{
                width: '24px',
                height: '24px',
                borderRadius: '3px',
                border: '1px solid #aaa',
                backgroundColor:
                  getColorItemByHex(batchClearSourceHex)?.hex ?? '#888888',
              }"
            ></div>
            <span>{{
              getColorItemByHex(batchClearSourceHex)?.colorCode ?? "--"
            }}</span>
            <el-input
              v-model="batchClearSearch"
              placeholder="输入色号如A03"
              size="small"
              @input="onClearSourceSearchInput"
              style="width: 140px"
            />
            <el-tooltip content="画布取色" effect="light">
              <el-button
                size="small"
                :icon="Sip"
                @click="pickMode = 'pickSource'"
              />
            </el-tooltip>
          </div>
        </div>
        <div v-if="pickMode !== 'none'" style="color: #f56c6c">
          提示：请点击画布拾取颜色
        </div>
      </div>
      <template #footer>
        <el-button @click="resetBatchDialogState">取消</el-button>
        <el-button type="primary" @click="execBatchClear">确认清空</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import { ElMessage } from "element-plus";
import {
  RiPencilLine as Pencil,
  RiEraserLine as Eraser,
  RiSipLine as Sip,
  RiArrowGoBackLine as ArrowGoBack,
  RiArrowGoForwardLine as ArrowGoForward,
  RiPaintLine as Paint,
  RiCircleLine as CircleLine,
  RiDeleteBin2Fill as DeleteBin,
  RiHand as Hand,
  RiPaintFill as BatchReplace,
  RiEraserFill as BatchClear,
  RiWindowLine,
} from "@remixicon/vue";
import { useHexBoard } from "@/hooks/useHexBoard";
import type { ToolType, HexBoardConfig } from "@/types/hexBead";
import { PERLER_BEAD_COLOR_LIBRARY } from "@/constants/perlerColorLibrary";

const canvasRef = ref<HTMLCanvasElement | null>(null);
const fileRef = ref<HTMLInputElement | null>(null);
const hexBoard = useHexBoard();
const selectedColor = hexBoard.selectedColor;
const currentTool = hexBoard.currentTool;
const {
  undo,
  redo,
  getBeads,
  setManualScale,
  getFinalScale,
  setPanOffset,
  resetPanOffset,
} = hexBoard;
const canUndo = hexBoard.canUndo;
const canRedo = hexBoard.canRedo;
const showRingGrid = hexBoard.showRingGrid;
const showRadialGuide = hexBoard.showRadialGuide;
const showBeadText = hexBoard.showBeadText;

const ringInput = ref(10);
const boardConfig = ref<HexBoardConfig>(hexBoard.getConfig());
// Element‑Plus滑块绑定变量
const manualScaleSlider = ref(1.0);

// 导出PNG弹窗状态
const exportPngDialogVisible = ref(false);
// 导出选项：是否在导出图纸绘制豆子色号
const exportDrawBeadText = ref(false);
const exportEnableWatermark = ref(false);
const exportWatermarkText = ref("@mizukikoo");

const beadCount = computed(() => getBeads().length);
//拖拽起点
let startMx = 0;
let startMy = 0;
let prevMx = 0;
let prevMy = 0;
const isDrawing = ref(false);
let hasMouseDown = false;
//最小拖动阈值，像素
const DRAG_THRESHOLD = 4;
// 是否本笔已经保存过快照（一笔拖拽只快照一次）
let strokeHasSnapshot = false;

// -----抓手hand工具局部状态-----
let panStartX = 0;
let panStartY = 0;
let panOffsetStartX = 0;
let panOffsetStartY = 0;
const isPanning = ref(false);

// 设置工具
function setTool(t: ToolType) {
  hexBoard.setTool(t);
}
// 设置色块颜色
function setColor(c: string) {
  hexBoard.setSelectedColor(c);
  scrollPaletteToColor(c);
}
// 滑块拖动回调
function handleScaleSlider() {
  setManualScale(manualScaleSlider.value);
  renderCanvas();
}
async function onRingChange() {
  hexBoard.generateBoard(ringInput.value, true);
  boardConfig.value = hexBoard.getConfig();
  await nextTick();
  renderCanvas();
}
function renderCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  hexBoard.renderPreview(ctx);
}
/**线段插值拖拽涂色 */
function paintLine(x0: number, y0: number, x1: number, y1: number) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  if (dist < 0.5) return;
  const step = hexBoard.getConfig().beadRadius * 0.7;
  const sampleCount = Math.max(1, Math.ceil(dist / step));
  for (let i = 0; i <= sampleCount; i++) {
    const t = i / sampleCount;
    const mx = x0 + (x1 - x0) * t;
    const my = y0 + (y1 - y0) * t;
    hexBoard.handleClickPixel(mx, my);
  }
  renderCanvas();
}
/**单击涂色（拖拽没有触发时的单击） */
function paintSingleClick(mx: number, my: number) {
  if (mx <= 0 && my <= 0) return;
  const hit = hexBoard.pixelToBead(mx, my);
  if (!hit) return;

  if (pickMode.value !== "none") {
    const target = hexBoard.getBead(hit.ring, hit.index);
    if (target?.color) {
      switch (pickMode.value) {
        case "pickSource":
          batchReplaceSourceHex.value = target.color;
          break;
        case "pickTarget":
          batchReplaceTargetHex.value = target.color;
          break;
        case "pickClearSource":
          batchClearSourceHex.value = target.color;
          break;
      }
    }
    pickMode.value = "none";
    renderCanvas();
    return;
  }

  //取色器只读操作
  if (currentTool.value === "picker") {
    hexBoard.handleClickPixel(mx, my);
    renderCanvas();
    scrollPaletteToColor(selectedColor.value);
    return;
  }

  const target = hexBoard.getBead(hit.ring, hit.index);
  if (!target) return;

  switch (currentTool.value) {
    case "brush":
    case "eraser": {
      const newColor =
        currentTool.value === "brush" ? selectedColor.value : null;
      //颜色无变化直接放弃
      if (target.color === newColor) return;
      hexBoard.saveSnapshot();
      hexBoard.handleClickPixel(mx, my);
      break;
    }
    case "fill":
    case "ringFill":
      hexBoard.saveSnapshot();
      hexBoard.handleClickPixel(mx, my);
      break;
    default:
      hexBoard.handleClickPixel(mx, my);
      break;
  }
  renderCanvas();
}

function onCanvasMouseDown(e: MouseEvent) {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  startMx = (e.clientX - rect.left) * scaleX;
  startMy = (e.clientY - rect.top) * scaleY;
  prevMx = startMx;
  prevMy = startMy;

  isDrawing.value = false;
  hasMouseDown = true;
  strokeHasSnapshot = false;

  // ========== 拾色模式（弹窗取色）优先 ==========
  if (pickMode.value !== "none") {
    const hit = hexBoard.pixelToBead(startMx, startMy);
    if (hit) {
      const target = hexBoard.getBead(hit.ring, hit.index);
      if (target?.color) {
        switch (pickMode.value) {
          case "pickSource":
            batchReplaceSourceHex.value = target.color;
            break;
          case "pickTarget":
            batchReplaceTargetHex.value = target.color;
            break;
          case "pickClearSource":
            batchClearSourceHex.value = target.color;
            break;
        }
      }
    }
    pickMode.value = "none";
    hasMouseDown = false;
    renderCanvas();
    return; // 取色完成，不再执行后续逻辑
  }

  if (currentTool.value === "hand") {
    isPanning.value = true;
    // 记录鼠标屏幕client坐标，不用canvas内部坐标
    panStartX = e.clientX;
    panStartY = e.clientY;
    // 记录拖拽开始时刻的偏移值
    panOffsetStartX = hexBoard.getConfig().panOffsetX;
    panOffsetStartY = hexBoard.getConfig().panOffsetY;
    canvasRef.value!.style.cursor = "grabbing";
    hasMouseDown = false;
    return;
  }

  // ========== 画布取色器工具 ==========
  if (currentTool.value === "picker") {
    hexBoard.handleClickPixel(startMx, startMy);
    renderCanvas();
    scrollPaletteToColor(selectedColor.value);
    return;
  }

  // ========== 普通绘制逻辑 ==========
  const hit = hexBoard.pixelToBead(startMx, startMy);
  if (!hit) return;

  const target = hexBoard.getBead(hit.ring, hit.index);
  if (!target) return;

  switch (currentTool.value) {
    case "brush":
    case "eraser": {
      const newColor =
        currentTool.value === "brush" ? selectedColor.value : null;
      if (target.color === newColor) {
        hasMouseDown = false;
        return;
      }
      hexBoard.saveSnapshot();
      strokeHasSnapshot = true;
      hexBoard.handleClickPixel(startMx, startMy);
      renderCanvas();
      break;
    }
    case "fill":
    case "ringFill":
      // 填充工具不支持拖拽，单击逻辑交给 stopDraw
      break;
    default:
      break;
  }
}

function onCanvasMouseMove(e: MouseEvent) {
  if (isPanning.value) {
    const dx = e.clientX - panStartX;
    const dy = e.clientY - panStartY;
    setPanOffset(panOffsetStartX + dx, panOffsetStartY + dy);
    renderCanvas();
    return;
  }

  if (!hasMouseDown) return;
  if (currentTool.value === "picker") return;
  //填充工具禁止拖拽绘制
  if (currentTool.value === "fill" || currentTool.value === "ringFill") return;

  const canvas = canvasRef.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  if (!isDrawing.value) {
    const moveDist = Math.hypot(mx - startMx, my - startMy);
    if (moveDist > DRAG_THRESHOLD) {
      isDrawing.value = true;
    }
  }
  if (isDrawing.value) {
    paintLine(prevMx, prevMy, mx, my);
    prevMx = mx;
    prevMy = my;
  }
}
function stopDraw() {
  if (isPanning.value) {
    isPanning.value = false;
    if (canvasRef.value) canvasRef.value.style.cursor = "grab";
  }
  //拖拽没激活，判定为单击
  if (!isDrawing.value && hasMouseDown) {
    paintSingleClick(startMx, startMy);
  }
  isDrawing.value = false;
  startMx = 0;
  startMy = 0;
  hasMouseDown = false;
  strokeHasSnapshot = false;
}
// 原来按钮点击事件：@click="handleExportPng" → 改为 @click="openExportPngDialog"
function openExportPngDialog() {
  exportPngDialogVisible.value = true;
}

// 实际执行导出逻辑，接收导出选项参数
async function doExportPng(drawBeadText: boolean) {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const offCanvas = document.createElement("canvas");
  const cfg = hexBoard.getConfig();
  const logicalSize = hexBoard.calcBoardLogicalSize(cfg.maxRing);

  offCanvas.width = logicalSize.width * dpr;
  offCanvas.height = logicalSize.height * dpr;

  const ctx = offCanvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  // 传入导出选项：是否绘制色号
  hexBoard.renderExport(
    ctx,
    drawBeadText,
    exportWatermarkText.value,
    exportEnableWatermark.value,
  );
  offCanvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hex-board-R${ringInput.value}.png`;
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png");
  exportPngDialogVisible.value = false;
  ElMessage.success("PNG图纸导出完成");
}

function handleExportJson() {
  const jsonText = hexBoard.exportProjectJson();
  const blob = new Blob([jsonText], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `hex-board-R${ringInput.value}.json`;
  link.click();
  URL.revokeObjectURL(url);
  ElMessage.success("JSON项目导出成功");
}
function handleClear() {
  hexBoard.clearBoard();
  renderCanvas();
}
function triggerImport() {
  fileRef.value?.click();
}
function onFileImport(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) {
    target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const str = ev.target?.result as string;
      hexBoard.importProjectJson(str);
      ringInput.value = hexBoard.getConfig().maxRing;
      boardConfig.value = hexBoard.getConfig();
      //导入后同步滑块
      manualScaleSlider.value = hexBoard.getConfig().manualScale;
      await nextTick();
      renderCanvas();
      ElMessage.success("项目导入成功");
    } catch (err) {
      ElMessage.error((err as Error).message);
    } finally {
      target.value = "";
    }
  };
  reader.readAsText(file);
}
function onUndo() {
  undo();
  renderCanvas();
}
function onRedo() {
  redo();
  renderCanvas();
}

const paletteDialogVisible = ref(false);
// 调色板弹窗色项 ref数组，弹窗内部每个color‑item DOM引用
const paletteItemRefs = ref<HTMLDivElement[]>([]);
// 标记弹窗是否已经完全打开(DOM已挂载)
const paletteDialogOpened = ref(false);
const setItemRef = (el: any) => {
  if (el && el instanceof HTMLDivElement) {
    paletteItemRefs.value.push(el);
  }
};
/**调色板弹窗打开完成，DOM已经渲染完毕 */
function onPaletteDialogOpened() {
  paletteDialogOpened.value = true;
  paletteItemRefs.value = [];
}
/**调色板弹窗关闭 */
function onPaletteDialogClosed() {
  paletteDialogOpened.value = false;
}
/** 根据hex颜色，在弹窗调色板滚动定位到对应色块 */
function scrollPaletteToColor(targetHex: string) {
  // 弹窗没有打开 / DOM没挂载 → 直接返回
  if (!paletteDialogVisible.value || !paletteDialogOpened.value) return;

  // 找到色库数组下标
  const idx = PERLER_BEAD_COLOR_LIBRARY.findIndex(
    (item) => item.hex === targetHex,
  );
  if (idx === -1) return; // 颜色不在色库，直接跳过

  const domEl = paletteItemRefs.value[idx];
  if (!domEl) return;

  // 平滑滚动到视口内，nearest：尽量最小幅度滚动
  domEl.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
  });
}
const currentSelectColorItem = computed(() => {
  return PERLER_BEAD_COLOR_LIBRARY.find(
    (item) => item.hex === selectedColor.value,
  );
});

// ========== 批量替换 / 批量清空 弹窗与拾取模式 ==========
type PickCanvasMode = "none" | "pickSource" | "pickTarget" | "pickClearSource";
const pickMode = ref<PickCanvasMode>("none");

// 批量替换弹窗
const batchReplaceDialogVisible = ref(false);
const batchReplaceSourceHex = ref<string | null>(null);
const batchReplaceTargetHex = ref<string | null>(null);
const batchReplaceSourceSearch = ref("");
const batchReplaceTargetSearch = ref("");

// 批量清空弹窗
const batchClearDialogVisible = ref(false);
const batchClearSourceHex = ref<string | null>(null);
const batchClearSearch = ref("");

/** 根据色号文本在色库查找颜色 */
function findColorByCode(codeText: string) {
  const t = codeText.trim().toUpperCase();
  if (!t) return null;
  const found = PERLER_BEAD_COLOR_LIBRARY.find(
    (c) => c.colorCode.toUpperCase() === t,
  );
  return found ?? null;
}

// 批量替换：源搜索输入变更
function onReplaceSourceSearchInput() {
  const item = findColorByCode(batchReplaceSourceSearch.value);
  batchReplaceSourceHex.value = item?.hex ?? null;
}
// 批量替换：目标搜索输入变更
function onReplaceTargetSearchInput() {
  const item = findColorByCode(batchReplaceTargetSearch.value);
  batchReplaceTargetHex.value = item?.hex ?? null;
}
// 批量清空：搜索输入变更
function onClearSourceSearchInput() {
  const item = findColorByCode(batchClearSearch.value);
  batchClearSourceHex.value = item?.hex ?? null;
}

/** 获取色库条目 by hex */
function getColorItemByHex(hex: string | null) {
  if (!hex) return null;
  return PERLER_BEAD_COLOR_LIBRARY.find((c) => c.hex === hex);
}

/** 关闭所有批量弹窗，重置状态 */
function resetBatchDialogState() {
  batchReplaceDialogVisible.value = false;
  batchClearDialogVisible.value = false;
  pickMode.value = "none";

  batchReplaceSourceHex.value = null;
  batchReplaceTargetHex.value = null;
  batchReplaceSourceSearch.value = "";
  batchReplaceTargetSearch.value = "";

  batchClearSourceHex.value = null;
  batchClearSearch.value = "";
}

/** 执行批量替换 */
function execBatchReplace() {
  const src = batchReplaceSourceHex.value;
  const dst = batchReplaceTargetHex.value;
  if (!src || !dst) {
    ElMessage.warning("源颜色与目标颜色都不能为空");
    return;
  }
  if (src === dst) {
    ElMessage.warning("源颜色和目标颜色不能相同");
    return;
  }
  hexBoard.saveSnapshot();
  const count = hexBoard.batchReplaceAllColor(src, dst);
  resetBatchDialogState();
  renderCanvas();
  ElMessage.success(`批量替换完成，共修改 ${count} 颗豆子`);
}

/** 执行批量清空 */
function execBatchClear() {
  const src = batchClearSourceHex.value;
  if (!src) {
    ElMessage.warning("请选择待清空的颜色");
    return;
  }
  hexBoard.saveSnapshot();
  const count = hexBoard.batchClearAllColor(src);
  resetBatchDialogState();
  renderCanvas();
  ElMessage.success(`批量清空完成，共修改 ${count} 颗豆子`);
}

onMounted(async () => {
  hexBoard.generateBoard(ringInput.value, false);
  boardConfig.value = hexBoard.getConfig();
  manualScaleSlider.value = hexBoard.getConfig().manualScale;
  await nextTick();
  renderCanvas();
  window.addEventListener("mouseup", stopDraw);
});
onUnmounted(() => {
  window.removeEventListener("mouseup", stopDraw);
});
</script>
<style scoped>
.color-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 4px 2px;
  border-radius: 4px;
  cursor: pointer;
}

.color-code {
  font-size: 11px;
  line-height: 1;
  color: #00000088;
  white-space: nowrap;
}

.color-block {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 2px solid #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}

/* 选中状态 */
.color-item.active {
  background-color: rgba(59, 130, 246, 0.25);
  border: 1px solid #3b82f6;
}
.color-item.active .color-block {
  border-color: #3b82f6;
}

/* hover提示 */
.color-item:hover {
  background-color: rgba(255, 255, 255, 0.08);
}
.long-button {
  margin-left: 2px;
}
:deep(.el-button + .el-button) {
  margin-left: 2px !important;
}
</style>
