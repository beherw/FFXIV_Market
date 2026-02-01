/**
 * Tesseract OCR 統一設定與除錯開關
 *
 * 勿在 setParameters 中設定 tessedit_ocr_engine_mode（OEM 已在 createWorker 時指定）。
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

/**
 * Tesseract v5 config reference (createWorker 4th arg = init, setParameters = runtime).
 *
 * --- INIT CONFIG (createWorker(lang, oem?, options?, config)) ---
 * Set only at init; cannot change later. Use TESSERACT_INIT_CONFIG below.
 *
 * | Parameter            | Type   | Description                    | We use |
 * |----------------------|--------|--------------------------------|--------|
 * | load_system_dawg     | 0/1    | Load main dictionary           | ✓ 1    |
 * | load_freq_dawg       | 0/1    | Load frequent-word dictionary  |        |
 * | load_unambig_dawg    | 0/1    | Load unambiguous word list     |        |
 * | load_punc_dawg       | 0/1    | Load punctuation dictionary   |        |
 * | load_number_dawg     | 0/1    | Load number dictionary         |        |
 * | load_bigram_dawg     | 0/1    | Load bigram dictionary         |        |
 * | user_words_suffix    | string | User words file extension      |        |
 *
 * --- RUNTIME PARAMS (worker.setParameters(params)) ---
 * Can be set after init. All values are strings.
 *
 * | Parameter                      | Typical  | Description                          | We use |
 * |--------------------------------|----------|-------------------------------------|--------|
 * | tessedit_pageseg_mode          | 0–13     | Page segmentation (7 = single line) | ✓ 7    |
 * | tessedit_char_whitelist        | chars    | Only recognize these chars          | ✓      |
 * | tessedit_char_blacklist        | chars    | Exclude these chars                 | ✓ ''   |
 * | classify_bln_numeric_mode      | 0/1      | Restrict to digits only             | ✓ 0    |
 * | classify_enable_learning       | 0/1      | Enable adaptive learning            | ✓ 0    |
 * | textord_min_linesize           | float    | Min line height (px)                | ✓      |
 * | textord_min_linesize_fraction  | float    | Min line height fraction            | ✓      |
 * | textord_min_blob_size          | int      | Min blob size (px)                  | ✓      |
 * | textord_min_blob_size_fraction | float    | Min blob size fraction              | ✓      |
 * | textord_excess_blob_size       | float    | Blob size tolerance                 | ✓      |
 * | textord_really_old_xheight     | float    | X-height threshold                   | ✓      |
 * | textord_really_old_xheight_fraction | float | X-height fraction threshold    | ✓      |
 * | textord_tabvector_vertical_gap_factor | float | Vertical gap factor           | ✓      |
 * | textord_debug_pitch_metric     | 0/1      | Debug pitch                         | ✓ 0    |
 * | textord_heavy_nr               | 0/1      | Heavy newline detection             | ✓ (ocrCore) |
 * | classify_adapt_proto_threshold | float    | Proto adaptation threshold           | ✓      |
 * | classify_adapt_feature_threshold | float  | Feature adaptation threshold         | ✓      |
 * | classify_misfit_junk_penalty   | float    | Misfit penalty                       | ✓      |
 * | classify_accept_rating         | float    | Accept rating threshold              | ✓      |
 * | classify_min_norm_scale_x      | float    | Min normalized scale                 | ✓ (ocrCore) |
 * | classify_max_rating_ratio     | float    | Max rating ratio                     | ✓ (ocrCore) |
 * | preserve_interword_spaces     | 0/1      | Keep spaces between words            |        |
 * | user_defined_dpi              | int      | Image DPI hint                       |        |
 *
 * PSM (tessedit_pageseg_mode): 0=OSD, 1=auto, 3=full block, 6=block, 7=single line, 13=raw line.
 * Full list: tesseract --print-parameters
 *
 * Already used in this project:
 * - Init: load_system_dawg (TESSERACT_INIT_CONFIG)
 * - Runtime (OCRButton + ocrCore): tessedit_pageseg_mode=7, tessedit_char_whitelist/blacklist,
 *   classify_bln_numeric_mode=0, classify_enable_learning=0, textord_* (linesize, blob, xheight,
 *   tabvector, debug_pitch), classify_adapt_*_threshold, classify_misfit_junk_penalty,
 *   classify_accept_rating; ocrCore also: textord_heavy_nr, classify_min_norm_scale_x,
 *   classify_max_rating_ratio.
 */
export const TESSERACT_INIT_CONFIG: Record<string, string> = {
  load_system_dawg: '1',
};

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
