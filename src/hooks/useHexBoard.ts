import { ref, type Ref } from "vue";
import type {
  HexBead,
  HexBoardConfig,
  ToolType,
  PerlerBeadColor,
} from "@/types/hexBead";
import { PERLER_BEAD_COLOR_LIBRARY } from "@/constants/perlerColorLibrary";

const colorLibraryHexSet = new Set(
  PERLER_BEAD_COLOR_LIBRARY.map((item) => item.hex),
);
// 构建hex色值映射色号，用于画布绘制文本
const hexToColorCodeMap = new Map<string, string>();
PERLER_BEAD_COLOR_LIBRARY.forEach((item) => {
  hexToColorCodeMap.set(item.hex, item.colorCode);
});

const MAX_HISTORY = 20;
const DEFAULT_BEAD_COLOR = "#dcdade";
// 预览画布DOM固定尺寸
const PREVIEW_CANVAS_FIXED_SIZE = 750;
// 手动缩放滑块范围
export const MANUAL_SCALE_MIN = 0.5;
export const MANUAL_SCALE_MAX = 2.0;
interface BoardSnapshot {
  beads: HexBead[];
  config: HexBoardConfig;
}
/**
 * 获取一颗豆子所有6个相邻豆子 (同心圆环六边形邻接关系)
 * 已修复：ring=1 ↔ ring=0 中心点双向连通问题
 */
function getNeighbourList(
  targetRing: number,
  targetIndex: number,
  maxRing: number,
): Array<{ ring: number; index: number }> {
  const neighbours: Array<{ ring: number; index: number }> = [];
  if (targetRing === 0) {
    // 中心点唯一豆子，邻接是 ring=1 全部6颗豆子(index 0,2,4,6,8,10)
    for (let i = 0; i < 6; i++) {
      neighbours.push({ ring: 1, index: i * 2 });
    }
    return neighbours;
  }
  // 1. 同一环左右邻居
  const ringTotal = 6 * targetRing;
  const leftIdx = (targetIndex - 1 + ringTotal) % ringTotal;
  const rightIdx = (targetIndex + 1) % ringTotal;
  neighbours.push({ ring: targetRing, index: leftIdx });
  neighbours.push({ ring: targetRing, index: rightIdx });
  // 2. 向内一环 (r‑1) 的邻居
  const innerRing = targetRing - 1;
  if (innerRing === 0) {
    // ring=1向内直接连中心点
    neighbours.push({ ring: 0, index: 0 });
  } else {
    const innerTotal = 6 * innerRing;
    const innerStep = targetRing / innerRing;
    const in1 = Math.floor(targetIndex / innerStep) % innerTotal;
    const in2 = (in1 + 1) % innerTotal;
    neighbours.push({ ring: innerRing, index: in1 });
    neighbours.push({ ring: innerRing, index: in2 });
  }
  // 3. 向外一环 (r+1) 的两个邻居，不超过最大圈
  if (targetRing + 1 <= maxRing) {
    const outerRing = targetRing + 1;
    const outerStep = outerRing / targetRing;
    const out1 = Math.floor(targetIndex * outerStep);
    const out2 = out1 + 1;
    const outerTotal = 6 * outerRing;
    neighbours.push({ ring: outerRing, index: out1 % outerTotal });
    neighbours.push({ ring: outerRing, index: out2 % outerTotal });
  }
  return neighbours;
}
export function useHexBoard() {
  let beads: HexBead[] = [];
  let config: HexBoardConfig = {
    maxRing: 10,
    beadStep: 22,
    beadRadius: 9,
    canvasWidth: PREVIEW_CANVAS_FIXED_SIZE,
    canvasHeight: PREVIEW_CANVAS_FIXED_SIZE,
    autoScale: 1.0,
    manualScale: 1.0,
    panOffsetX: 0,
    panOffsetY: 0,
  };

  const selectedColor = ref<string>(
    PERLER_BEAD_COLOR_LIBRARY[0]?.hex ?? "#FAF4C8",
  );

  const currentTool = ref<ToolType>("brush");
  // ---------------- 撤销重做快照栈 ----------------
  let undoStack: BoardSnapshot[] = [];
  let redoStack: BoardSnapshot[] = [];
  const canUndo = ref(false);
  const canRedo = ref(false);
  const isHistoryOperation = ref(false);

  // ---------------- 网格显示开关（仅本地会话，不进JSON导出） ----------------
  const showRingGrid = ref(true);
  const showRadialGuide = ref(true);
  const showBeadText = ref(false);

  /**保存快照，修改画布前调用；新增栈顶去重兜底 */
  function saveSnapshot() {
    if (isHistoryOperation.value) return;

    const snapshot: BoardSnapshot = JSON.parse(
      JSON.stringify({ beads, config }),
    );
    const topItem = undoStack[undoStack.length - 1];
    // 和栈顶状态完全一样 → 放弃入栈，过滤无效快照
    if (topItem && JSON.stringify(topItem) === JSON.stringify(snapshot)) {
      return;
    }

    undoStack.push(snapshot);
    redoStack = [];
    if (undoStack.length > MAX_HISTORY) {
      undoStack.shift();
    }
    canUndo.value = undoStack.length > 0;
    canRedo.value = false;
  }

  /**撤销 */
  function undo() {
    if (undoStack.length === 0) return;
    isHistoryOperation.value = true;
    redoStack.push(JSON.parse(JSON.stringify({ beads, config })));
    const snap = undoStack.pop()!;
    beads = snap.beads;
    config = snap.config;
    canUndo.value = undoStack.length > 0;
    canRedo.value = redoStack.length > 0;
    isHistoryOperation.value = false;
  }
  /**重做 */
  function redo() {
    if (redoStack.length === 0) return;
    isHistoryOperation.value = true;
    undoStack.push(JSON.parse(JSON.stringify({ beads, config })));
    const snap = redoStack.pop()!;
    beads = snap.beads;
    config = snap.config;
    canUndo.value = true;
    canRedo.value = redoStack.length > 0;
    isHistoryOperation.value = false;
  }
  /** 根据圈数，计算拼豆板本身需要的逻辑尺寸（非DOM画布尺寸） */
  function calcBoardLogicalSize(maxRing: number) {
    const outerRadius = maxRing * config.beadStep;
    // 安全边距，防止最外圈豆子被裁切
    const margin = config.beadRadius * 3;
    const size = Math.ceil((outerRadius + margin) * 2);
    return { width: size, height: size };
  }
  /**
   * 更新自动适配缩放比例：让拼豆板完整放入固定预览画布内
   */
  function updateAutoScale() {
    const logical = calcBoardLogicalSize(config.maxRing);
    const domW = config.canvasWidth;
    const domH = config.canvasHeight;
    // 计算宽高缩放比例，取最小的值保证全部放下
    const scaleX = domW / logical.width;
    const scaleY = domH / logical.height;
    config.autoScale = Math.min(scaleX, scaleY);
  }
  /** 获取最终合成缩放值 */
  function getFinalScale() {
    return config.autoScale * config.manualScale;
  }
  /** 设置用户手动缩放倍率 */
  function setManualScale(value: number) {
    // 钳位限制范围
    config.manualScale = Math.max(
      MANUAL_SCALE_MIN,
      Math.min(MANUAL_SCALE_MAX, value),
    );
  }
  /** 获取画布中心点（逻辑画布中心点） */
  function getCanvasCenter() {
    const logical = calcBoardLogicalSize(config.maxRing);
    return {
      cx: logical.width / 2,
      cy: logical.height / 2,
    };
  }
  /**
   * 获取指定圈数豆子总数
   */
  function getBeadCountByRing(maxR: number): number {
    return 1 + 6 * ((maxR * (maxR + 1)) / 2);
  }

  /**
   * 获取单颗豆子，上层鼠标点击预判颜色变更使用
   */
  function getBead(ring: number, index: number): HexBead | undefined {
    return beads.find((b) => b.ring === ring && b.index === index);
  }

  /**
   * 生成实体同心圆环拼豆板（圈数变化时保留已有涂色）
   * @param maxRing 目标圈数
   * @param saveHistory 是否保存快照
   */
  function generateBoard(maxRing: number, saveHistory = true): HexBead[] {
    // 强制圈数锁定区间：10‑26
    const targetRing = Math.max(10, Math.min(26, maxRing));
    // 保存旧圈数（如果 beads 为空，说明是首次初始化）
    const oldMaxRing = beads.length > 0 ? config.maxRing : 0;

    // ----- 情况2: 圈数不变（直接返回现有数据）-----
    if (targetRing === oldMaxRing) {
      return [...beads];
    }

    // 圈数确定会改动，此刻才保存快照
    if (saveHistory) {
      saveSnapshot();
    }

    // 更新配置中的圈数
    config.maxRing = targetRing;
    // 更新自动适配缩放
    updateAutoScale();
    const newList: HexBead[] = [];
    // ----- 情况1: 首次初始化（beads为空）-----
    if (beads.length === 0) {
      // ✅ 修改：初始化豆子color赋值为 null（空白），渲染层展示默认色
      newList.push({ ring: 0, index: 0, color: null });
      for (let ring = 1; ring <= targetRing; ring++) {
        const count = 6 * ring;
        for (let i = 0; i < count; i++) {
          newList.push({ ring, index: i, color: null });
        }
      }
      beads = newList;
      return [...beads];
    }
    // ----- 情况3: 圈数变化，保留重叠部分涂色 -----
    // 3.1 复制重叠部分的豆子（0 ~ min(oldMaxRing, targetRing)）
    const copyUpTo = Math.min(oldMaxRing, targetRing);
    // 构建一个 Map 用于快速查找旧数据（按 ring+index 作为key）
    const oldBeadMap = new Map<string, HexBead>();
    for (const b of beads) {
      const key = `${b.ring}-${b.index}`;
      oldBeadMap.set(key, b);
    }
    // 复制重叠区域的豆子（保留颜色）
    for (let ring = 0; ring <= copyUpTo; ring++) {
      const count = ring === 0 ? 1 : 6 * ring;
      for (let i = 0; i < count; i++) {
        const key = `${ring}-${i}`;
        const oldBead = oldBeadMap.get(key);
        if (oldBead) {
          newList.push({ ...oldBead });
        } else {
          // ✅ 修改：新增空白豆子存储 null
          newList.push({ ring, index: i, color: null });
        }
      }
    }
    // 3.2 如果圈数变大：新增外圈豆子（空白 = null）
    if (targetRing > oldMaxRing) {
      for (let ring = oldMaxRing + 1; ring <= targetRing; ring++) {
        const count = 6 * ring;
        for (let i = 0; i < count; i++) {
          newList.push({ ring, index: i, color: null });
        }
      }
    }
    // 3.3 如果圈数变小：外圈超出部分自动丢弃（上面已经只复制到 copyUpTo）
    // 验证豆子数量是否正确
    const expectedCount = getBeadCountByRing(targetRing);
    if (newList.length !== expectedCount) {
      console.warn(
        `豆子数量不匹配: 预期 ${expectedCount}, 实际 ${newList.length}，重新生成完整列表`,
      );
      // 如果数量不匹配，回退到完整生成
      return generateFullBoard(targetRing);
    }
    beads = newList;
    return [...beads];
  }
  /**
   * 生成完整的豆子列表（用于首次初始化或修复）
   */
  function generateFullBoard(maxRing: number): HexBead[] {
    const list: HexBead[] = [];
    // ✅ 修改：完整生成空白豆子 color=null
    list.push({ ring: 0, index: 0, color: null });
    for (let ring = 1; ring <= maxRing; ring++) {
      const count = 6 * ring;
      for (let i = 0; i < count; i++) {
        list.push({ ring, index: i, color: null });
      }
    }
    return list;
  }
  /**
   * 根据 ring + index 得到豆子屏幕像素坐标（逻辑画布坐标）
   */
  function beadToPixel(ring: number, index: number) {
    const { cx, cy } = getCanvasCenter();
    if (ring === 0) {
      return { x: cx, y: cy };
    }
    const r = ring * config.beadStep;
    const total = 6 * ring;
    const angle = (2 * Math.PI * index) / total;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  }
  /** DOM画布鼠标坐标 → 逻辑画布坐标 */
  function screenToLogical(px: number, py: number) {
    const domW = config.canvasWidth;
    const domH = config.canvasHeight;
    const logical = calcBoardLogicalSize(config.maxRing);
    const logicalCx = logical.width / 2;
    const logicalCy = logical.height / 2;
    const scale = getFinalScale();
    //反向变换，把屏幕点还原成逻辑坐标
    const lx = (px - domW / 2 - config.panOffsetX) / scale + logicalCx;
    const ly = (py - domH / 2 - config.panOffsetY) / scale + logicalCy;
    return { x: lx, y: ly };
  }
  /**
   * 鼠标画布像素坐标 → 命中豆子 {ring,index} | null
   */
  function pixelToBead(
    px: number,
    py: number,
  ): { ring: number; index: number } | null {
    // 屏幕坐标转逻辑坐标
    const logical = screenToLogical(px, py);
    px = logical.x;
    py = logical.y;
    const { cx, cy } = getCanvasCenter();
    const dx = px - cx;
    const dy = py - cy;
    const distMouse = Math.hypot(dx, dy);
    let hitRing: number;
    if (distMouse < config.beadStep * 0.5) {
      hitRing = 0;
      return { ring: 0, index: 0 };
    }
    //修复：floor代替round，消除中线闪烁
    hitRing = Math.floor((distMouse + 4) / config.beadStep);
    hitRing = Math.max(1, Math.min(config.maxRing, hitRing));
    let angleMouse = Math.atan2(dy, dx);
    angleMouse = angleMouse < 0 ? angleMouse + Math.PI * 2 : angleMouse;
    const count = 6 * hitRing;
    let idx =
      Math.round(((angleMouse + 1e-12) / (Math.PI * 2)) * count) % count;
    idx = (idx + count) % count;
    const beadPos = beadToPixel(hitRing, idx);
    const d = Math.hypot(px - beadPos.x, py - beadPos.y);
    if (d > config.beadRadius * 1.5) {
      return null;
    }
    return { ring: hitRing, index: idx };
  }
  function setBeadColor(
    targetRing: number,
    targetIndex: number,
    color: string | null,
  ) {
    beads = beads.map((b) => {
      if (b.ring === targetRing && b.index === targetIndex) {
        return { ...b, color };
      }
      return b;
    });
    return [...beads];
  }
  //======= 1:整圆环填充 ringFill =======
  function fillEntireRing(targetRing: number) {
    beads = beads.map((b) => {
      if (b.ring === targetRing) {
        return { ...b, color: selectedColor.value };
      }
      return b;
    });
  }
  //======= 2:洪水填充(油漆桶BFS连通填充)｜优化版，减少重复map遍历 =======
  function floodFill(startRing: number, startIndex: number) {
    const startBead = beads.find(
      (b) => b.ring === startRing && b.index === startIndex,
    );
    if (!startBead) return;
    const sourceColor = startBead.color;
    const destColor = selectedColor.value;
    if (sourceColor === destColor) return;
    const beadMap = new Map<string, HexBead>();
    for (const b of beads) {
      beadMap.set(`${b.ring}-${b.index}`, b);
    }
    const visited = new Set<string>();
    const queue: Array<{ ring: number; index: number }> = [];
    const startKey = `${startRing}-${startIndex}`;
    visited.add(startKey);
    queue.push({ ring: startRing, index: startIndex });
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const currKey = `${curr.ring}-${curr.index}`;
      const currBead = beadMap.get(currKey);
      if (!currBead) continue;
      currBead.color = destColor;
      const neighborList = getNeighbourList(
        curr.ring,
        curr.index,
        config.maxRing,
      );
      for (const nb of neighborList) {
        const nbKey = `${nb.ring}-${nb.index}`;
        if (visited.has(nbKey)) continue;
        const nbBead = beadMap.get(nbKey);
        if (!nbBead) continue;
        if (nbBead.color !== sourceColor) continue;
        visited.add(nbKey);
        queue.push(nb);
      }
    }
    beads = Array.from(beadMap.values());
  }
  function handleClickPixel(mx: number, my: number) {
    const hit = pixelToBead(mx, my);
    if (!hit) return [...beads];
    const { ring, index } = hit;
    switch (currentTool.value) {
      case "brush":
        return setBeadColor(ring, index, selectedColor.value);
      case "eraser":
        // ✅ 修改：橡皮擦 → 设置 null（空白豆子）
        return setBeadColor(ring, index, null);
      case "picker": {
        const found = beads.find((b) => b.ring === ring && b.index === index);
        // ✅ 修改：空豆子或者颜色不在色库内，跳过拾取
        if (
          found &&
          found.color !== null &&
          colorLibraryHexSet.has(found.color)
        ) {
          selectedColor.value = found.color;
        }
        break;
      }

      case "ringFill":
        fillEntireRing(ring);
        break;
      case "fill":
        floodFill(ring, index);
        break;
    }
    return [...beads];
  }
  function clearBoard() {
    saveSnapshot();
    // ✅ 修改：清空画布全部豆子设为 null
    beads = beads.map((b) => ({ ...b, color: null }));
    return [...beads];
  }
  /** 预览渲染：带辅助同心圆网格 */
  /** 预览渲染：带辅助同心圆网格 */
  function renderPreview(ctx: CanvasRenderingContext2D) {
    const domW = config.canvasWidth;
    const domH = config.canvasHeight;
    ctx.clearRect(0, 0, domW, domH);
    ctx.save();
    // 1. 移动画布原点到DOM画布中心点
    ctx.translate(domW / 2, domH / 2);
    // ✅新增：应用抓手拖拽平移偏移
    ctx.translate(config.panOffsetX, config.panOffsetY);
    // 2. 执行最终缩放
    ctx.scale(getFinalScale(), getFinalScale());
    // 3. 反向偏移逻辑画布的中心点，让图形居中
    const logical = calcBoardLogicalSize(config.maxRing);
    const logicalCx = logical.width / 2;
    const logicalCy = logical.height / 2;
    ctx.translate(-logicalCx, -logicalCy);

    //绘制圆环网格
    ctx.strokeStyle = "#c0beb8";
    ctx.lineWidth = 0.8;
    if (showRingGrid.value) {
      for (let ring = 0; ring <= config.maxRing; ring++) {
        const r = ring * config.beadStep;
        const { cx, cy } = getCanvasCenter();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // ==========【新增：六等分放射辅助线】==========
    if (showRadialGuide.value) {
      const { cx, cy } = getCanvasCenter();
      const outerMaxR = config.maxRing * config.beadStep;
      const angleStep = (Math.PI * 2) / 6;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = i * angleStep;
        const endX = cx + outerMaxR * Math.cos(angle);
        const endY = cy + outerMaxR * Math.sin(angle);
        ctx.moveTo(cx, cy);
        ctx.lineTo(endX, endY);
      }
      ctx.stroke();
    }
    drawAllBeads(ctx);
    ctx.restore();
  }

  /** 导出图纸渲染：无网格线 + 白色背景，适合打印，原始尺寸，不缩放 */
  function renderExport(
    ctx: CanvasRenderingContext2D,
    drawBeadText: boolean,
    watermarkText: string,
    enableWatermark: boolean,
  ) {
    const logical = calcBoardLogicalSize(config.maxRing);
    const w = logical.width;
    const h = logical.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    // 绘制豆子
    drawAllBeads(ctx, drawBeadText);

    // 绘制平铺倾斜水印（启用水印才执行）
    if (enableWatermark && watermarkText.trim()) {
      drawTiledWatermark(ctx, w, h, watermarkText);
    }
  }

  /**
   * 绘制逆时针倾斜30度 网格平铺水印
   * @param ctx canvas上下文
   * @param width 画布宽
   * @param height 画布高
   * @param text 水印文字
   */
  function drawTiledWatermark(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    text: string,
  ) {
    ctx.save();
    // 水印样式：半透浅灰
    ctx.fillStyle = "rgba(180,180,180,0.22)";
    ctx.font = "16px sans‑serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const tileW = 220; // 平铺格子宽度
    const tileH = 140; // 平铺格子高度
    const angle = (-30 * Math.PI) / 180; // 逆时针30度 = -30°

    // 扩大绘制范围，避免边缘出现空白缺口
    const extra = Math.max(width, height);
    for (let x = -extra; x < width + extra; x += tileW) {
      for (let y = -extra; y < height + extra; y += tileH) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  /** 绘制所有豆子公共函数 */
  function drawAllBeads(
    ctx: CanvasRenderingContext2D,
    forceDrawText?: boolean,
  ) {
    for (const b of beads) {
      const pos = beadToPixel(b.ring, b.index);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, config.beadRadius, 0, Math.PI * 2);
      // ✅ 修改：color===null 渲染默认豆子底色
      if (b.color) {
        ctx.fillStyle = b.color;
      } else {
        ctx.fillStyle = DEFAULT_BEAD_COLOR;
      }
      ctx.fill();
      ctx.strokeStyle = "#cccccc";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // 判定：优先使用forceDrawText；没有传就用预览开关 showBeadText.value
      const shouldDrawText =
        forceDrawText !== undefined ? forceDrawText : showBeadText.value;

      // ==========【绘制豆子色号文本】==========
      if (shouldDrawText && b.color !== null) {
        const code = hexToColorCodeMap.get(b.color);
        if (code) {
          ctx.save();
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          // 根据豆子半径动态适配字号
          const fontSize = Math.max(7, config.beadRadius * 0.65);
          ctx.font = `bold ${fontSize}px sans‑serif`;
          ctx.fillStyle = getTextColorForBackground(b.color);
          ctx.fillText(code, pos.x, pos.y);
          ctx.restore();
        }
      }
      // =============================================
    }
  }

  function exportProjectJson() {
    return JSON.stringify(
      {
        beads,
        config,
        editorState: {
          selectedColor: selectedColor.value,
          currentTool: currentTool.value,
        },
      },
      null,
      2,
    );
  }
  function importProjectJson(jsonStr: string) {
    saveSnapshot();
    const obj = JSON.parse(jsonStr);
    const expectedCount = getBeadCountByRing(obj.config.maxRing);
    if (obj.beads.length !== expectedCount) {
      throw new Error(
        `项目文件校验失败：圈数${obj.config.maxRing},预期豆子数:${expectedCount}，实际豆子数${obj.beads.length}，数据不匹配，拒绝导入`,
      );
    }
    beads = obj.beads;
    config = { ...obj.config };
    //导入后刷新自动缩放适配
    updateAutoScale();
    if (obj.editorState) {
      selectedColor.value = obj.editorState.selectedColor ?? "#ff4444";
      currentTool.value = obj.editorState.currentTool;
    }
    resetPanOffset();
    return { beads: [...beads], config: { ...config } };
  }
  // 新增：获取所有豆子的方法（用于导出图片）
  function getAllBeads(): HexBead[] {
    return [...beads];
  }

  /** 根据hex颜色返回适合的文本颜色 #000000 / #ffffff */
  function getTextColorForBackground(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    // 相对亮度公式
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#000000" : "#ffffff";
  }

  /**
   * 批量替换：所有 sourceHex 的豆子替换为 targetHex
   * @returns 被修改豆子数量
   */
  function batchReplaceAllColor(sourceHex: string, targetHex: string): number {
    let changed = 0;
    for (const bead of beads) {
      if (bead.color === sourceHex) {
        bead.color = targetHex;
        changed++;
      }
    }
    return changed;
  }

  /**
   * 批量清空：所有 sourceHex 的豆子置为 null（空白豆子）
   * @returns 被修改豆子数量
   */
  function batchClearAllColor(sourceHex: string): number {
    let changed = 0;
    for (const bead of beads) {
      if (bead.color === sourceHex) {
        bead.color = null;
        changed++;
      }
    }
    return changed;
  }
  /** 设置预览拖拽平移偏移 */
  function setPanOffset(dx: number, dy: number) {
    config.panOffsetX = dx;
    config.panOffsetY = dy;
  }
  /** 重置视图平移，回到居中 */
  function resetPanOffset() {
    config.panOffsetX = 0;
    config.panOffsetY = 0;
  }

  return {
    generateBoard,
    beadToPixel,
    pixelToBead,
    setBeadColor,
    handleClickPixel,
    clearBoard,
    renderPreview,
    renderExport,
    exportProjectJson,
    importProjectJson,
    getCanvasCenter,
    getBeadCountByRing,
    getBeads: () => [...beads],
    getConfig: () => ({ ...config }),
    getAllBeads,
    getBead,
    calcBoardLogicalSize,
    setSelectedColor: (c: string) => {
      selectedColor.value = c;
    },
    setTool: (t: ToolType) => {
      currentTool.value = t;
    },
    selectedColor,
    currentTool,
    saveSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
    setManualScale,
    getFinalScale,
    showRingGrid,
    showRadialGuide,
    showBeadText,
    batchReplaceAllColor,
    batchClearAllColor,
    setPanOffset,
    resetPanOffset,
  };
}
