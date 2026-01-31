/**
 * Tesseract OCR 統一設定與除錯開關
 *
 * 圖片送入後的處理流程（Filter 順序）：
 * 0. 載入與縮放：imageSmoothing → resize（若過大）→ imageScale 放大
 * 1. 基礎：灰階 → 對比度增強 → 檢測淺色文字並反轉（可選）
 * 2. 進階去噪（可選）：雙邊濾波 → 去網格線 → 高斯模糊 → 中值濾波
 * 3. 銳化（可選）
 * 4. 二值化：Otsu 自動閾值或固定閾值 → 黑白二值化（可選）
 * 5. 形態學（可選）：開運算 → 閉運算
 * 6. 送入 Tesseract 前：可選自動檢測文字區域並裁剪
 *
 * 調試方式：在瀏覽器主控台設定 window.__TESSERACT_CONFIG__ 覆寫預設值，下次 OCR 即生效。
 * 例：關閉除錯日誌
 *   window.__TESSERACT_CONFIG__ = { enableDebugLogs: false };
 * 例：開啟雙邊濾波與銳化測試
 *   window.__TESSERACT_CONFIG__ = { filters: { enableBilateralFilter: true, enableSharpen: true } };
 * 例：還原預設（清除覆寫）
 *   window.__TESSERACT_CONFIG__ = undefined;
 */

export const OCR_PIPELINE_STEPS = [
  '0: load & scale (imageSmoothing, resize, imageScale)',
  '1: grayscale → contrast → invertForLightText',
  '2: denoise (bilateral, removeGridLines, gaussian, median)',
  '3: sharpen',
  '4: binarization (Otsu/threshold)',
  '5: morphology (open, close)',
  '6: auto text region crop (before Tesseract)',
] as const;

export interface TesseractFiltersConfig {
  enableImageSmoothing: boolean;
  enableImageScale: boolean;
  enableClipboardImageSmoothing: boolean;
  enableCropImageSmoothing: boolean;
  enableGrayscale: boolean;
  enableContrastEnhancement: boolean;
  enableInvertForLightText: boolean;
  enableBilateralFilter: boolean;
  enableRemoveGridLines: boolean;
  enableGaussianBlur: boolean;
  enableMedianFilter: boolean;
  enableSharpen: boolean;
  enableAutoThreshold: boolean;
  enableBinarization: boolean;
  enableMorphologyOpen: boolean;
  enableMorphologyClose: boolean;
  enableAutoTextDetection: boolean;
}

export interface TesseractConfig {
  tesseractLang: string;
  imageScale: number;
  threshold: number;
  maxImageDimension: number;
  enableAdvancedProcessing: boolean;
  enableAutoThreshold: boolean;
  minConfidence: number;
  excludeSymbolsAndNumbersAtRecognition: boolean;
  invertForLightText: boolean;
  useItemtwWhitelist: boolean;
  enableAutoTextDetection: boolean;
  autoCropPadding: number;
  enableMorphologyClose: boolean;
  morphologyCloseKernelSize: number;
  sharpenStrength: 'normal' | 'strong';
  debugMode: boolean;
  enableDebugLogs: boolean;
  enableCropPreviewZoom: boolean;
  cropPreviewZoomFactor: number;
  enableCropPreviewSmoothing: boolean;
  enableDebugImageSmoothing: boolean;
  filters: TesseractFiltersConfig;
}

const defaultFilters: TesseractFiltersConfig = {
  enableImageSmoothing: true,
  enableImageScale: true,
  enableClipboardImageSmoothing: true,
  enableCropImageSmoothing: true,
  enableGrayscale: true,
  enableContrastEnhancement: true,
  enableInvertForLightText: true,
  enableBilateralFilter: false,
  enableRemoveGridLines: false,
  enableGaussianBlur: false,
  enableMedianFilter: false,
  enableSharpen: false,
  enableAutoThreshold: true,
  enableBinarization: false,
  enableMorphologyOpen: false,
  enableMorphologyClose: false,
  enableAutoTextDetection: true,
};

const defaultConfig: TesseractConfig = {
  tesseractLang: 'chi_tra',
  imageScale: 4,
  threshold: 128,
  maxImageDimension: 2500,
  enableAdvancedProcessing: true,
  enableAutoThreshold: true,
  minConfidence: 0,
  excludeSymbolsAndNumbersAtRecognition: false,
  invertForLightText: true,
  useItemtwWhitelist: true,
  enableAutoTextDetection: true,
  autoCropPadding: 1,
  enableMorphologyClose: true,
  morphologyCloseKernelSize: 2,
  sharpenStrength: 'strong',
  debugMode: false,
  enableDebugLogs: false,
  enableCropPreviewZoom: true,
  cropPreviewZoomFactor: 2.5,
  enableCropPreviewSmoothing: true,
  enableDebugImageSmoothing: false,
  filters: defaultFilters,
};

function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T> | undefined): T {
  if (source == null) return target;
  const out = { ...target };
  for (const key of Object.keys(source) as (keyof T)[]) {
    const s = source[key];
    if (s === undefined) continue;
    if (key === 'filters' && typeof out.filters === 'object' && typeof s === 'object' && s !== null) {
      (out as Record<string, unknown>).filters = { ...(out.filters as object), ...(s as object) };
    } else {
      (out as Record<string, unknown>)[key as string] = s;
    }
  }
  return out;
}

declare global {
  interface Window {
    __TESSERACT_CONFIG__?: Partial<TesseractConfig> & { filters?: Partial<TesseractFiltersConfig> };
  }
}

/**
 * 取得目前 Tesseract 設定（預設 + window.__TESSERACT_CONFIG__ 覆寫）
 */
export function getTesseractConfig(): TesseractConfig {
  const override = typeof window !== 'undefined' ? window.__TESSERACT_CONFIG__ : undefined;
  return deepMerge(defaultConfig, override) as TesseractConfig;
}

/** Debug logging disabled; kept as no-op for API compatibility. */
export function ocrDebugLog(..._args: unknown[]): void {
  // no-op
}
