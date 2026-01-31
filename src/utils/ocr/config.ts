/**
 * OCR 配置
 */

export const OCR_CONFIG = {
  tesseractLang: 'chi_tra', // 使用 Tesseract 原生 CDN 模型
  imageScale: 6.5,
  threshold: 128,
  maxImageDimension: 2500,
  enableAdvancedProcessing: true,
  enableAutoThreshold: true,
  minConfidence: 0,
  excludeSymbolsAndNumbersAtRecognition: false,
  invertForLightText: true,
  useItemtwWhitelist: true,
  enableAutoTextDetection: true,
  autoCropPadding: 5,
  enableMorphologyClose: true,
  morphologyCloseKernelSize: 2,
  sharpenStrength: 'strong' as 'normal' | 'strong',
} as const;
