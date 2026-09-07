//hexBead.ts
/** 同心圆环实体圆形拼豆板单颗豆子 */
export interface HexBead {
  ring: number;
  index: number; // 当前圈内序号 0 ~ (12*ring‑1)
  /** null=空豆子；#RRGGBB */
  color: string | null;
}

/** MARD拼豆色库条目 */
export type PerlerBeadColor = {
  colorCode: string;
  hex: string;
  rgb: [number, number, number];
};

/** 画布配置 */
export interface HexBoardConfig {
  maxRing: number;
  beadStep: number;
  beadRadius: number;
  canvasWidth: number;
  canvasHeight: number;
  autoScale: number; // 自动适配缩放值
  manualScale: number; // 用户手动缩放倍率
  panOffsetX: number;
  panOffsetY: number;
}

export type ToolType =
  | "brush"
  | "eraser"
  | "picker"
  | "hand"
  | "fill"
  | "ringFill"
  | "batchReplace"
  | "batchClear";
