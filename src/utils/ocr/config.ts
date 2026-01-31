/**
 * OCR 配置
 */

export const OCR_CONFIG = {
  tesseractLang: 'chi_tra', // 使用 Tesseract 原生 CDN 模型
  imageScale: 8, // 大幅提高放大倍數以提升識別度（針對高筆畫數繁體字優化）
  threshold: 128,
  maxImageDimension: 3000, // 提高最大尺寸限制以支持更大的放大倍數
  enableAdvancedProcessing: true,
  enableAutoThreshold: true,
  minConfidence: 0, // 降低信心度閾值以保留複雜字符（針對高筆畫數字符優化）
  excludeSymbolsAndNumbersAtRecognition: false,
  invertForLightText: true,
  useItemtwWhitelist: true,
  enableAutoTextDetection: true,
  autoCropPadding: 2, // 稍微增加以確保完整字符
  enableMorphologyClose: true,
  morphologyCloseKernelSize: 3, // 增加閉運算核大小（針對高筆畫數繁體字優化）
  sharpenStrength: 'strong' as 'normal' | 'strong',
} as const;
