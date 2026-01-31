import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

// Tesseract.js v5 類型聲明（從 CDN 載入）
// v5 API: createWorker(langs?, oem?, options?, config?)
// - langs: 語言代碼，可以是 string | string[]（例如 'chi_tra' 或 ['chi_tra', 'eng']）
// - loadLanguage 和 initialize 已被棄用，語言在創建時指定
declare global {
  interface Window {
    Tesseract: {
      createWorker: (
        langs?: string | string[],
        oem?: number,
        options?: {
          logger?: (m: any) => void;
          errorHandler?: (err: any) => void;
          [key: string]: any;
        },
        config?: string | Record<string, any>
      ) => Promise<{
        // v5: loadLanguage 和 initialize 已被移除
        setParameters: (params: Record<string, string>) => Promise<void>;
        recognize: (image: HTMLImageElement | ImageData | string, options?: any) => Promise<{
          data: {
            text: string;
            words?: Array<{
              text: string;
              bbox: { x0: number; y0: number; x1: number; y1: number };
              confidence: number;
            }>;
            lines?: Array<{
              text: string;
              bbox: { x0: number; y0: number; x1: number; y1: number };
            }>;
            paragraphs?: Array<{
              text: string;
              bbox: { x0: number; y0: number; x1: number; y1: number };
            }>;
            blocks?: Array<{
              text: string;
              bbox: { x0: number; y0: number; x1: number; y1: number };
            }>;
          };
        }>;
        terminate: () => Promise<void>;
        // v5: 如果需要重新初始化，使用 reinitialize
        reinitialize?: (langs?: string | string[], oem?: number, config?: string | Record<string, any>) => Promise<void>;
      }>;
    };
  }
}

// OCR 配置 - 針對繁體中文優化，最大化識別度
// 特別針對深色紋理背景+淺色文字的場景進行優化
const CONFIG = {
  tesseractLang: 'chi_tra', // 只支援繁體中文
  imageScale: 4.0, // 提高放大倍數以提升識別度（針對紋理背景場景，更大的尺寸有助於識別）
  threshold: 128,
  maxImageDimension: 2000,
  enableAdvancedProcessing: true, // 啟用進階處理以提升識別度
  enableAutoThreshold: true, // 啟用自動閾值
  minConfidence: 0, // 最低信心度閾值（0-100），低於此值的單詞會被過濾掉（設為 5 以保留幾乎所有識別結果，只過濾極低把握度的結果）
  // 是否在 Tesseract 識別階段直接排除數字和符號（true=識別時排除，false=識別後過濾）
  // 注意：設置為 true 可能會略微影響中文識別準確度（因為符號可能有助於斷句），但可以提高效率
  excludeSymbolsAndNumbersAtRecognition: false, // 預設為 false（識別後過濾），推薦保持此設定以獲得最佳識別準確度
};

/**
 * 讀入圖片檔案為 Image 物件
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  console.log('[OCR DEBUG] loadImage: 開始載入圖片', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    timestamp: new Date().toISOString(),
  });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      console.log('[OCR DEBUG] loadImage: FileReader onload 成功', {
        resultLength: (e.target?.result as string)?.length,
        timestamp: new Date().toISOString(),
      });

      const img = new Image();
      img.onload = () => {
        console.log('[OCR DEBUG] loadImage: Image onload 成功', {
          width: img.width,
          height: img.height,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          timestamp: new Date().toISOString(),
        });
        resolve(img);
      };
      img.onerror = (error) => {
        console.error('[OCR DEBUG] loadImage: Image onerror', {
          error,
          timestamp: new Date().toISOString(),
        });
        reject(error);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = (error) => {
      console.error('[OCR DEBUG] loadImage: FileReader onerror', {
        error,
        timestamp: new Date().toISOString(),
      });
      reject(error);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * 若圖片尺寸過大則縮放
 */
function resizeImageIfNeeded(image: HTMLImageElement): Promise<HTMLImageElement> {
  console.log('[OCR DEBUG] resizeImageIfNeeded: 開始檢查圖片尺寸', {
    width: image.width,
    height: image.height,
    maxDimension: CONFIG.maxImageDimension,
    timestamp: new Date().toISOString(),
  });

  return new Promise((resolve) => {
    const maxDim = CONFIG.maxImageDimension;
    const { width, height } = image;

    if (width <= maxDim && height <= maxDim) {
      console.log('[OCR DEBUG] resizeImageIfNeeded: 圖片尺寸符合要求，無需縮放', {
        width,
        height,
        timestamp: new Date().toISOString(),
      });
      resolve(image);
      return;
    }

    const scale = Math.min(maxDim / width, maxDim / height);
    const newWidth = Math.floor(width * scale);
    const newHeight = Math.floor(height * scale);

    console.log('[OCR DEBUG] resizeImageIfNeeded: 開始縮放圖片', {
      originalWidth: width,
      originalHeight: height,
      newWidth,
      newHeight,
      scale,
      timestamp: new Date().toISOString(),
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = newWidth;
    canvas.height = newHeight;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, newWidth, newHeight);

    const resizedImg = new Image();
    resizedImg.onload = () => {
      console.log('[OCR DEBUG] resizeImageIfNeeded: 縮放完成', {
        finalWidth: resizedImg.width,
        finalHeight: resizedImg.height,
        timestamp: new Date().toISOString(),
      });
      resolve(resizedImg);
    };
    resizedImg.src = canvas.toDataURL('image/png');
  });
}

/**
 * Otsu 自動閾值
 */
function calculateOtsuThreshold(imageData: ImageData): number {
  const data = imageData.data;
  const histogram = new Array(256).fill(0);
  const totalPixels = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    );
    histogram[gray]++;
  }

  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let sumB = 0;
  let wB = 0;
  let maxVariance = 0;
  let threshold = 0;

  for (let i = 0; i < 256; i++) {
    wB += histogram[i];
    if (wB === 0) continue;

    const wF = totalPixels - wB;
    if (wF === 0) break;

    sumB += i * histogram[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;

    const variance = wB * wF * (mB - mF) * (mB - mF);
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = i;
    }
  }

  return threshold;
}

/**
 * 中值濾波（去噪）
 */
function applyMedianFilter(imageData: ImageData, radius = 1): ImageData {
  const { data, width, height } = imageData;
  const newData = new Uint8ClampedArray(data);

  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      const values: number[] = [];
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          values.push(data[idx]);
        }
      }
      values.sort((a, b) => a - b);
      const median = values[Math.floor(values.length / 2)];
      const idx = (y * width + x) * 4;
      newData[idx] = median;
      newData[idx + 1] = median;
      newData[idx + 2] = median;
    }
  }

  return new ImageData(newData, width, height);
}

/**
 * 高斯模糊（用於背景平滑）
 */
function applyGaussianBlur(imageData: ImageData, radius = 1): ImageData {
  const { data, width, height } = imageData;
  const newData = new Uint8ClampedArray(data);
  
  // 簡化的高斯核（3x3）
  const kernel = [
    [1, 2, 1],
    [2, 4, 2],
    [1, 2, 1]
  ];
  const kernelSum = 16;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          const weight = kernel[dy + 1][dx + 1];
          sum += data[idx] * weight;
        }
      }
      const idx = (y * width + x) * 4;
      const value = Math.round(sum / kernelSum);
      newData[idx] = value;
      newData[idx + 1] = value;
      newData[idx + 2] = value;
    }
  }

  return new ImageData(newData, width, height);
}

/**
 * 形態學開運算（去除小噪點）
 */
function applyMorphologyOpen(imageData: ImageData, kernelSize = 2): ImageData {
  const { data, width, height } = imageData;
  const newData = new Uint8ClampedArray(data);
  
  // 先進行腐蝕
  const eroded = new Uint8ClampedArray(data);
  for (let y = kernelSize; y < height - kernelSize; y++) {
    for (let x = kernelSize; x < width - kernelSize; x++) {
      let minVal = 255;
      for (let dy = -kernelSize; dy <= kernelSize; dy++) {
        for (let dx = -kernelSize; dx <= kernelSize; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          minVal = Math.min(minVal, data[idx]);
        }
      }
      const idx = (y * width + x) * 4;
      eroded[idx] = minVal;
      eroded[idx + 1] = minVal;
      eroded[idx + 2] = minVal;
    }
  }
  
  // 再進行膨脹
  for (let y = kernelSize; y < height - kernelSize; y++) {
    for (let x = kernelSize; x < width - kernelSize; x++) {
      let maxVal = 0;
      for (let dy = -kernelSize; dy <= kernelSize; dy++) {
        for (let dx = -kernelSize; dx <= kernelSize; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          maxVal = Math.max(maxVal, eroded[idx]);
        }
      }
      const idx = (y * width + x) * 4;
      newData[idx] = maxVal;
      newData[idx + 1] = maxVal;
      newData[idx + 2] = maxVal;
    }
  }

  return new ImageData(newData, width, height);
}

/**
 * 銳化濾波（增強文字邊緣）
 */
function applySharpen(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const newData = new Uint8ClampedArray(data);
  
  // 銳化核
  const kernel = [
    [0, -1, 0],
    [-1, 5, -1],
    [0, -1, 0]
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          const weight = kernel[dy + 1][dx + 1];
          sum += data[idx] * weight;
        }
      }
      const idx = (y * width + x) * 4;
      const value = Math.max(0, Math.min(255, sum));
      newData[idx] = value;
      newData[idx + 1] = value;
      newData[idx + 2] = value;
    }
  }

  return new ImageData(newData, width, height);
}

/**
 * 自適應對比度增強（針對深色背景+淺色文字優化）
 */
function enhanceContrastForDarkBackground(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const newData = new Uint8ClampedArray(data);
  
  // 計算圖像的亮度分佈
  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    sum += gray;
    count++;
  }
  const avgBrightness = sum / count;
  
  // 如果平均亮度較低（深色背景），使用更激進的對比度增強
  const isDarkBackground = avgBrightness < 100;
  const contrastFactor = isDarkBackground ? 2.5 : 1.8; // 深色背景使用更高對比度
  const brightnessShift = isDarkBackground ? -20 : 0; // 深色背景稍微降低亮度以增強對比
  
  console.log('[OCR DEBUG] enhanceContrastForDarkBackground: 對比度增強', {
    avgBrightness,
    isDarkBackground,
    contrastFactor,
    brightnessShift,
    timestamp: new Date().toISOString(),
  });

  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    
    // 增強對比度
    let enhanced = (gray - 128) * contrastFactor + 128 + brightnessShift;
    enhanced = Math.max(0, Math.min(255, enhanced));
    
    newData[i] = enhanced;
    newData[i + 1] = enhanced;
    newData[i + 2] = enhanced;
    newData[i + 3] = data[i + 3]; // 保留 alpha
  }

  return new ImageData(newData, width, height);
}

/**
 * 圖片前處理：放大 + 灰階 + 對比度 + 二值化 + 去噪
 * 針對深色紋理背景+淺色文字進行優化
 */
function preprocessImage(image: HTMLImageElement): Promise<HTMLImageElement> {
  console.log('[OCR DEBUG] preprocessImage: 開始圖片前處理', {
    inputWidth: image.width,
    inputHeight: image.height,
    imageScale: CONFIG.imageScale,
    enableAdvancedProcessing: CONFIG.enableAdvancedProcessing,
    enableAutoThreshold: CONFIG.enableAutoThreshold,
    timestamp: new Date().toISOString(),
  });

  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    const scale = CONFIG.imageScale;
    const width = Math.floor(image.width * scale);
    const height = Math.floor(image.height * scale);

    console.log('[OCR DEBUG] preprocessImage: 計算放大後尺寸', {
      originalWidth: image.width,
      originalHeight: image.height,
      scaledWidth: width,
      scaledHeight: height,
      scale,
      timestamp: new Date().toISOString(),
    });

    canvas.width = width;
    canvas.height = height;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, width, height);

    let imageData = ctx.getImageData(0, 0, width, height);
    console.log('[OCR DEBUG] preprocessImage: 取得 ImageData', {
      dataLength: imageData.data.length,
      width: imageData.width,
      height: imageData.height,
      timestamp: new Date().toISOString(),
    });

    // 步驟1: 先進行灰階化
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      );
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
    ctx.putImageData(imageData, 0, 0);
    imageData = ctx.getImageData(0, 0, width, height);

    // 步驟2: 針對深色背景+淺色文字進行自適應對比度增強
    console.log('[OCR DEBUG] preprocessImage: 開始自適應對比度增強', {
      timestamp: new Date().toISOString(),
    });
    const beforeContrast = Date.now();
    imageData = enhanceContrastForDarkBackground(imageData);
    const afterContrast = Date.now();
    console.log('[OCR DEBUG] preprocessImage: 對比度增強完成', {
      duration: afterContrast - beforeContrast,
      timestamp: new Date().toISOString(),
    });

    // 步驟3: 啟用進階處理（去噪和背景平滑）
    if (CONFIG.enableAdvancedProcessing) {
      console.log('[OCR DEBUG] preprocessImage: 開始高斯模糊平滑背景', {
        timestamp: new Date().toISOString(),
      });
      const beforeBlur = Date.now();
      imageData = applyGaussianBlur(imageData, 1);
      const afterBlur = Date.now();
      console.log('[OCR DEBUG] preprocessImage: 高斯模糊完成', {
        duration: afterBlur - beforeBlur,
        timestamp: new Date().toISOString(),
      });

      console.log('[OCR DEBUG] preprocessImage: 開始中值濾波去噪', {
        timestamp: new Date().toISOString(),
      });
      const beforeFilter = Date.now();
      imageData = applyMedianFilter(imageData, 1);
      const afterFilter = Date.now();
      console.log('[OCR DEBUG] preprocessImage: 中值濾波完成', {
        duration: afterFilter - beforeFilter,
        timestamp: new Date().toISOString(),
      });
    }

    // 步驟4: 銳化處理（增強文字邊緣）
    console.log('[OCR DEBUG] preprocessImage: 開始銳化處理', {
      timestamp: new Date().toISOString(),
    });
    const beforeSharpen = Date.now();
    imageData = applySharpen(imageData);
    const afterSharpen = Date.now();
    console.log('[OCR DEBUG] preprocessImage: 銳化完成', {
      duration: afterSharpen - beforeSharpen,
      timestamp: new Date().toISOString(),
    });

    // 步驟5: 計算自動閾值
    let threshold = CONFIG.threshold;
    if (CONFIG.enableAutoThreshold) {
      console.log('[OCR DEBUG] preprocessImage: 開始計算 Otsu 閾值', {
        timestamp: new Date().toISOString(),
      });
      const beforeThreshold = Date.now();
      threshold = calculateOtsuThreshold(imageData);
      const afterThreshold = Date.now();
      console.log('[OCR DEBUG] preprocessImage: Otsu 閾值計算完成', {
        threshold,
        duration: afterThreshold - beforeThreshold,
        timestamp: new Date().toISOString(),
      });
    } else {
      console.log('[OCR DEBUG] preprocessImage: 使用固定閾值', {
        threshold,
        timestamp: new Date().toISOString(),
      });
    }

    // 步驟6: 二值化
    console.log('[OCR DEBUG] preprocessImage: 開始二值化', {
      threshold,
      pixelCount: imageData.data.length / 4,
      timestamp: new Date().toISOString(),
    });

    const beforeBinarization = Date.now();
    const processedData = imageData.data;
    for (let i = 0; i < processedData.length; i += 4) {
      const gray = processedData[i];
      const binary = gray > threshold ? 255 : 0;
      processedData[i] = binary;
      processedData[i + 1] = binary;
      processedData[i + 2] = binary;
    }
    const afterBinarization = Date.now();

    console.log('[OCR DEBUG] preprocessImage: 二值化完成', {
      duration: afterBinarization - beforeBinarization,
      timestamp: new Date().toISOString(),
    });

    // 步驟7: 形態學開運算（去除小噪點，連接斷裂的文字）
    if (CONFIG.enableAdvancedProcessing) {
      console.log('[OCR DEBUG] preprocessImage: 開始形態學開運算', {
        timestamp: new Date().toISOString(),
      });
      const beforeMorphology = Date.now();
      imageData = applyMorphologyOpen(imageData, 1);
      const afterMorphology = Date.now();
      console.log('[OCR DEBUG] preprocessImage: 形態學開運算完成', {
        duration: afterMorphology - beforeMorphology,
        timestamp: new Date().toISOString(),
      });
    }

    ctx.putImageData(imageData, 0, 0);

    const processedImg = new Image();
    processedImg.onload = () => {
      console.log('[OCR DEBUG] preprocessImage: 前處理完成', {
        finalWidth: processedImg.width,
        finalHeight: processedImg.height,
        timestamp: new Date().toISOString(),
      });
      resolve(processedImg);
    };
    processedImg.src = canvas.toDataURL('image/png');
  });
}

/**
 * 過濾文字，只保留繁體中文字
 * 移除所有符號、數字、英文等非中文字符
 * 但保留空格，用於標記缺失字符的位置
 */
function filterChineseOnly(text: string): string {
  // 繁體中文字 Unicode 範圍：
  // - 基本漢字：\u4E00-\u9FFF
  // - 擴展A：\u3400-\u4DBF
  // 保留這些範圍內的字符和空格
  // 將非中文字符（除了空格）替換為空格，然後合併連續空格
  const chineseWithSpaces = text
    .replace(/[^\u3400-\u4DBF\u4E00-\u9FFF\s]/g, ' ')  // 非中文字符（除了空格）替換為空格
    .replace(/\s+/g, ' ');  // 合併連續空格為單個空格
  return chineseWithSpaces.trim();
}

/**
 * 使用 Tesseract.js 執行 OCR
 */
async function performOCR(
  image: HTMLImageElement,
  onProgress?: (p: number) => void
): Promise<string> {
  const startTime = Date.now();
  console.log('[OCR DEBUG] performOCR: 開始 OCR 識別', {
    imageWidth: image.width,
    imageHeight: image.height,
    imageSrc: image.src.substring(0, 50) + '...',
    hasProgressCallback: !!onProgress,
    timestamp: new Date().toISOString(),
  });

  try {
    // 檢查 Tesseract 是否已載入
    console.log('[OCR DEBUG] performOCR: 檢查 Tesseract.js 是否載入', {
      isDefined: typeof window.Tesseract !== 'undefined',
      tesseractType: typeof window.Tesseract,
      timestamp: new Date().toISOString(),
    });

    if (typeof window.Tesseract === 'undefined') {
      console.error('[OCR DEBUG] performOCR: Tesseract.js 未載入', {
        timestamp: new Date().toISOString(),
      });
      throw new Error('Tesseract.js 尚未載入，請稍候再試');
    }

    // Tesseract.js v5: 語言需要在 createWorker 時直接指定
    // loadLanguage 和 initialize 已被棄用，不再需要調用
    console.log('[OCR DEBUG] performOCR: 開始創建 Worker（指定語言）', {
      language: CONFIG.tesseractLang,
      timestamp: new Date().toISOString(),
    });
    const workerCreateStart = Date.now();
    // v5 API: createWorker(lang) - 直接在創建時指定語言
    const worker = await window.Tesseract.createWorker(CONFIG.tesseractLang);
    const workerCreateEnd = Date.now();
    console.log('[OCR DEBUG] performOCR: Worker 創建成功（已預載語言）', {
      duration: workerCreateEnd - workerCreateStart,
      language: CONFIG.tesseractLang,
      workerType: typeof worker,
      timestamp: new Date().toISOString(),
    });

    // 設定 OCR 參數以提升繁體中文識別度
    // 根據配置決定是否在識別階段直接排除數字和符號
    let chineseCharWhitelist = '';
    
    if (CONFIG.excludeSymbolsAndNumbersAtRecognition) {
      // 方案：在識別階段直接排除數字和符號
      // 構建繁體中文字符白名單（Unicode範圍：\u3400-\u4DBF 和 \u4E00-\u9FFF）
      // 注意：由於中文字符數量龐大（數萬個），完整列出所有字符不現實
      // 這裡我們採用一個實用方案：設置 whitelist 為空字符串，但通過其他參數來減少數字識別
      // 實際上，Tesseract 在使用中文語言模型時，會優先識別中文字符
      // 設置 classify_bln_numeric_mode 為 '0' 可以禁用數字模式，減少數字誤識別
      
      // 如果確實需要嚴格限制，可以構建一個包含常用中文字符的 whitelist
      // 但這可能會影響識別準確度，因為完全排除符號可能影響斷句理解
      // 因此這裡保持為空字符串，主要通過後處理過濾來排除數字和符號
      
      // 可選的嚴格模式（如果確實需要，可以取消註釋）：
      // const commonChineseChars: string[] = [];
      // // 生成基本漢字範圍（\u4E00-\u9FFF，共20992個字符）
      // for (let i = 0x4E00; i <= 0x9FFF; i++) {
      //   commonChineseChars.push(String.fromCharCode(i));
      // }
      // // 生成擴展A範圍（\u3400-\u4DBF）
      // for (let i = 0x3400; i <= 0x4DBF; i++) {
      //   commonChineseChars.push(String.fromCharCode(i));
      // }
      // chineseCharWhitelist = commonChineseChars.join('');
      
      // 當前採用折中方案：保持為空字符串，通過 classify_bln_numeric_mode 減少數字識別
      // 數字和符號會在後處理階段通過 filterChineseOnly 函數過濾
      chineseCharWhitelist = '';
      
      console.log('[OCR DEBUG] performOCR: 啟用識別階段排除模式（通過參數優化）', {
        whitelistLength: chineseCharWhitelist.length,
        note: '實際排除將在後處理階段進行',
        timestamp: new Date().toISOString(),
      });
    } else {
      // 方案：識別所有字符，在後處理階段過濾（推薦，準確度更高）
      chineseCharWhitelist = '';
      console.log('[OCR DEBUG] performOCR: 使用識別後過濾模式（推薦）', {
        timestamp: new Date().toISOString(),
      });
    }
    
    const params = {
      tessedit_char_whitelist: chineseCharWhitelist, // 空字符串 = 不限制字符（讓 Tesseract 使用語言模型的默認字符集）
      tessedit_pageseg_mode: '6', // 統一文本塊
      // 提升識別準確度的參數
      tessedit_ocr_engine_mode: '1', // LSTM OCR Engine（更準確）
      classify_bln_numeric_mode: '0', // 不限制為數字模式（0=禁用數字模式，有助於減少數字誤識別）
      textord_min_linesize: '2.5', // 最小行尺寸
      classify_enable_learning: '0', // 禁用學習模式以保持一致性
      // 針對深色背景+淺色文字的優化參數
      tessedit_char_blacklist: '', // 不排除任何字符
      textord_tabvector_vertical_gap_factor: '0.5', // 減少垂直間隙因子，有助於識別緊密排列的文字
      textord_min_blob_size_fraction: '0.1', // 降低最小blob尺寸分數，識別更小的文字
      textord_excess_blob_size: '1.3', // 增加blob尺寸容忍度
      // 提升文字識別敏感度
      textord_really_old_xheight: '0.9', // 降低x高度閾值，識別更小的文字
      classify_adapt_proto_threshold: '0.5', // 降低原型適應閾值，提高識別敏感度
      classify_adapt_feature_threshold: '0.5', // 降低特徵適應閾值
    };
    console.log('[OCR DEBUG] performOCR: 設定 OCR 參數', {
      params,
      timestamp: new Date().toISOString(),
    });
    await worker.setParameters(params);
    console.log('[OCR DEBUG] performOCR: OCR 參數設定完成', {
      timestamp: new Date().toISOString(),
    });

    // 使用 recognize 方法
    // 注意：由於 logger 函數無法透過 postMessage 傳遞給 Worker，
    // 我們暫時移除詳細的進度追蹤以避免 DataCloneError
    // OCR 功能會正常運作，但進度條會在完成時直接跳到 100%
    console.log('[OCR DEBUG] performOCR: 開始執行 recognize', {
      imageWidth: image.width,
      imageHeight: image.height,
      timestamp: new Date().toISOString(),
    });
    const recognizeStart = Date.now();
    const result = await worker.recognize(image);
    const recognizeEnd = Date.now();
    console.log('[OCR DEBUG] performOCR: recognize 完成', {
      duration: recognizeEnd - recognizeStart,
      resultTextLength: result.data.text?.length || 0,
      resultTextPreview: result.data.text?.substring(0, 100) || '',
      hasWords: !!result.data.words,
      wordCount: result.data.words?.length || 0,
      wordsConfidence: result.data.words?.map((w) => ({
        text: w.text,
        confidence: w.confidence,
      })) || [],
      timestamp: new Date().toISOString(),
    });
    
    // 如果提供了 onProgress 回調，在識別完成時更新進度
    if (onProgress) {
      console.log('[OCR DEBUG] performOCR: 更新進度回調', {
        progress: 1.0,
        timestamp: new Date().toISOString(),
      });
      // 由於無法直接獲取詳細進度，我們可以模擬進度更新
      // 或者只在完成時設置為 100%
      onProgress(1.0);
    }

    console.log('[OCR DEBUG] performOCR: 開始終止 Worker', {
      timestamp: new Date().toISOString(),
    });
    const terminateStart = Date.now();
    await worker.terminate();
    const terminateEnd = Date.now();
    console.log('[OCR DEBUG] performOCR: Worker 終止完成', {
      duration: terminateEnd - terminateStart,
      timestamp: new Date().toISOString(),
    });

    // 如果有 words 資料，先過濾低 confidence 的單詞
    // 對於被過濾掉的單詞，在對應位置插入空格以保持結構
    let filteredText = result.data.text;
    
    if (result.data.words && result.data.words.length > 0) {
      console.log('[OCR DEBUG] performOCR: 開始過濾低 confidence 單詞', {
        totalWords: result.data.words.length,
        minConfidence: CONFIG.minConfidence,
        timestamp: new Date().toISOString(),
      });

      // 按照 bbox 的 x0 位置排序，確保按照從左到右的順序處理
      const sortedWords = [...result.data.words].sort((a, b) => {
        // 先按 y0（垂直位置）排序，再按 x0（水平位置）排序
        if (Math.abs(a.bbox.y0 - b.bbox.y0) > 5) {
          return a.bbox.y0 - b.bbox.y0;
        }
        return a.bbox.x0 - b.bbox.x0;
      });

      // 構建過濾後的文字：低 confidence 的單詞用空格替換
      const filteredParts: string[] = [];
      sortedWords.forEach((word, index) => {
        if (word.confidence >= CONFIG.minConfidence && word.text.trim().length > 0) {
          // 高 confidence 單詞：保留文字
          filteredParts.push(word.text);
        } else {
          // 低 confidence 單詞：用空格替換，保持位置
          // 根據單詞長度插入對應數量的空格
          const spaceCount = Math.max(1, Math.ceil(word.text.length));
          filteredParts.push(' '.repeat(spaceCount));
        }
      });

      filteredText = filteredParts.join('');

      const removedCount = sortedWords.filter(
        (w) => w.confidence < CONFIG.minConfidence || w.text.trim().length === 0
      ).length;

      console.log('[OCR DEBUG] performOCR: confidence 過濾完成', {
        originalWordCount: result.data.words.length,
        filteredWordCount: sortedWords.length - removedCount,
        removedWordCount: removedCount,
        removedWords: sortedWords
          .filter((w) => w.confidence < CONFIG.minConfidence || w.text.trim().length === 0)
          .map((w) => ({ text: w.text, confidence: w.confidence })),
        filteredTextPreview: filteredText.substring(0, 100),
        timestamp: new Date().toISOString(),
      });
    } else {
      console.warn('[OCR DEBUG] performOCR: 沒有 words 資料，跳過 confidence 過濾', {
        timestamp: new Date().toISOString(),
      });
    }

    // 清理多餘空白，但保留單個空格（用於標記缺失字符的位置）
    // 將多個連續空格合併為單個空格
    const cleanedText = filteredText
      .replace(/\s+/g, ' ')  // 多個空白合併為單個空格
      .replace(/\n+/g, ' ')  // 換行符轉為空格
      .trim();

    console.log('[OCR DEBUG] performOCR: 清理後的文字', {
      originalLength: result.data.text.length,
      filteredLength: filteredText.length,
      cleanedLength: cleanedText.length,
      cleanedText,
      timestamp: new Date().toISOString(),
    });

    // 過濾，只保留繁體中文字
    const processedText = filterChineseOnly(cleanedText);

    const totalDuration = Date.now() - startTime;
    console.log('[OCR DEBUG] performOCR: OCR 識別完成', {
      totalDuration,
      originalText: result.data.text,
      cleanedText,
      finalTextLength: processedText.length,
      finalText: processedText,
      timestamp: new Date().toISOString(),
    });

    return processedText;
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error('[OCR DEBUG] performOCR: OCR 識別錯誤', {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      totalDuration,
      timestamp: new Date().toISOString(),
    });
    throw new Error('OCR 辨識過程發生錯誤');
  }
}

/**
 * 從剪貼簿讀取圖片
 */
function loadImageFromClipboard(
  clipboardData: DataTransfer
): Promise<HTMLImageElement> {
  console.log('[OCR DEBUG] loadImageFromClipboard: 開始從剪貼簿讀取圖片', {
    itemCount: clipboardData.items.length,
    timestamp: new Date().toISOString(),
  });

  return new Promise((resolve, reject) => {
    const items = clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      console.log('[OCR DEBUG] loadImageFromClipboard: 檢查剪貼簿項目', {
        index: i,
        type: item.type,
        kind: item.kind,
        timestamp: new Date().toISOString(),
      });

      if (item.type.indexOf('image') !== -1) {
        console.log('[OCR DEBUG] loadImageFromClipboard: 找到圖片項目', {
          type: item.type,
          timestamp: new Date().toISOString(),
        });

        const blob = item.getAsFile();
        if (!blob) {
          console.error('[OCR DEBUG] loadImageFromClipboard: 無法取得檔案', {
            itemType: item.type,
            itemKind: item.kind,
            timestamp: new Date().toISOString(),
          });
          reject(new Error('無法讀取剪貼簿中的圖片檔案，請確認圖片已正確複製'));
          return;
        }

        console.log('[OCR DEBUG] loadImageFromClipboard: 開始讀取 Blob', {
          blobSize: blob.size,
          blobType: blob.type,
          timestamp: new Date().toISOString(),
        });

        const reader = new FileReader();
        reader.onload = (e) => {
          console.log('[OCR DEBUG] loadImageFromClipboard: FileReader onload', {
            resultLength: (e.target?.result as string)?.length,
            timestamp: new Date().toISOString(),
          });

          const img = new Image();
          img.onload = () => {
            console.log('[OCR DEBUG] loadImageFromClipboard: Image onload 成功', {
              width: img.width,
              height: img.height,
              timestamp: new Date().toISOString(),
            });
            resolve(img);
          };
          img.onerror = (error) => {
            console.error('[OCR DEBUG] loadImageFromClipboard: Image onerror', {
              error,
              blobType: blob.type,
              blobSize: blob.size,
              timestamp: new Date().toISOString(),
            });
            reject(new Error('圖片格式不正確或已損壞，無法載入圖片'));
          };
          img.src = e.target?.result as string;
        };
        reader.onerror = (error) => {
          console.error('[OCR DEBUG] loadImageFromClipboard: FileReader onerror', {
            error,
            blobType: blob.type,
            blobSize: blob.size,
            timestamp: new Date().toISOString(),
          });
          reject(new Error('讀取剪貼簿圖片時發生錯誤，請嘗試重新複製圖片'));
        };
        reader.readAsDataURL(blob);
        return;
      }
    }
    console.error('[OCR DEBUG] loadImageFromClipboard: 剪貼簿中沒有圖片', {
      itemCount: items.length,
      itemTypes: Array.from(items).map((item) => item.type),
      itemKinds: Array.from(items).map((item) => item.kind),
      timestamp: new Date().toISOString(),
    });
    reject(new Error('剪貼簿中沒有圖片，請先複製圖片後再貼上'));
  });
}

/**
 * 處理圖片並執行 OCR
 */
async function processImageForOCR(
  file: File,
  onProgress?: (p: number) => void
): Promise<string> {
  const startTime = Date.now();
  console.log('[OCR DEBUG] processImageForOCR: 開始處理圖片', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    hasProgressCallback: !!onProgress,
    timestamp: new Date().toISOString(),
  });

  try {
    console.log('[OCR DEBUG] processImageForOCR: 步驟 1/4 - 載入圖片', {
      timestamp: new Date().toISOString(),
    });
    const img = await loadImage(file);
    console.log('[OCR DEBUG] processImageForOCR: 步驟 1/4 完成', {
      timestamp: new Date().toISOString(),
    });

    console.log('[OCR DEBUG] processImageForOCR: 步驟 2/4 - 檢查並縮放圖片', {
      timestamp: new Date().toISOString(),
    });
    const resizedImage = await resizeImageIfNeeded(img);
    console.log('[OCR DEBUG] processImageForOCR: 步驟 2/4 完成', {
      timestamp: new Date().toISOString(),
    });

    console.log('[OCR DEBUG] processImageForOCR: 步驟 3/4 - 圖片前處理', {
      timestamp: new Date().toISOString(),
    });
    const processedImage = await preprocessImage(resizedImage);
    console.log('[OCR DEBUG] processImageForOCR: 步驟 3/4 完成', {
      timestamp: new Date().toISOString(),
    });

    console.log('[OCR DEBUG] processImageForOCR: 步驟 4/4 - 執行 OCR', {
      timestamp: new Date().toISOString(),
    });
    const recognizedText = await performOCR(processedImage, onProgress);
    console.log('[OCR DEBUG] processImageForOCR: 步驟 4/4 完成', {
      timestamp: new Date().toISOString(),
    });

    const finalText = recognizedText.trim();
    const totalDuration = Date.now() - startTime;
    console.log('[OCR DEBUG] processImageForOCR: 所有步驟完成', {
      totalDuration,
      finalTextLength: finalText.length,
      finalText,
      timestamp: new Date().toISOString(),
    });

    return finalText;
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error('[OCR DEBUG] processImageForOCR: 處理過程發生錯誤', {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      totalDuration,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

interface OCRButtonProps {
  onTextRecognized?: (text: string) => void;
  disabled?: boolean;
}

/**
 * OCR 按鈕組件
 */
interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function OCRButton({
  onTextRecognized,
  disabled,
}: OCRButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [needsCrop, setNeedsCrop] = useState(false);
  const [originalImageFile, setOriginalImageFile] = useState<File | null>(null);
  const [originalImageSize, setOriginalImageSize] = useState<{ width: number; height: number } | null>(null);
  const [cropArea, setCropArea] = useState<CropArea | null>(null);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [cropStartPos, setCropStartPos] = useState<{ x: number; y: number } | null>(null);
  const [cropPreview, setCropPreview] = useState<string | null>(null);
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);
  const [previewDragStart, setPreviewDragStart] = useState<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // 裁剪圖片
  const cropImage = useCallback(async (file: File, cropArea: CropArea): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        if (!imageRef.current || !cropContainerRef.current) {
          reject(new Error('圖片元素不存在'));
          return;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        // 獲取容器和圖片的實際尺寸
        const containerRect = cropContainerRef.current.getBoundingClientRect();
        const imgRect = imageRef.current.getBoundingClientRect();
        
        // 計算圖片在容器中的實際顯示位置和尺寸
        const displayX = imgRect.left - containerRect.left;
        const displayY = imgRect.top - containerRect.top;
        const displayWidth = imgRect.width;
        const displayHeight = imgRect.height;
        
        // 計算縮放比例
        const scaleX = img.width / displayWidth;
        const scaleY = img.height / displayHeight;
        
        // 將裁剪區域坐標轉換為相對於圖片的坐標
        const relativeX = cropArea.x - displayX;
        const relativeY = cropArea.y - displayY;
        
        // 計算實際裁剪區域（轉換為原始圖片坐標）
        const actualX = Math.max(0, Math.min(img.width, relativeX * scaleX));
        const actualY = Math.max(0, Math.min(img.height, relativeY * scaleY));
        const actualWidth = Math.max(0, Math.min(img.width - actualX, cropArea.width * scaleX));
        const actualHeight = Math.max(0, Math.min(img.height - actualY, cropArea.height * scaleY));
        
        if (actualWidth <= 0 || actualHeight <= 0) {
          reject(new Error('裁剪區域無效'));
          return;
        }
        
        canvas.width = actualWidth;
        canvas.height = actualHeight;
        
        ctx.drawImage(
          img,
          actualX, actualY, actualWidth, actualHeight,
          0, 0, actualWidth, actualHeight
        );
        
        canvas.toBlob((blob) => {
          if (blob) {
            const croppedFile = new File([blob], file.name, { type: file.type });
            resolve(croppedFile);
          } else {
            reject(new Error('裁剪失敗'));
          }
        }, file.type);
      };
      img.onerror = () => reject(new Error('圖片載入失敗'));
      img.src = URL.createObjectURL(file);
    });
  }, []);

  // 處理圖片識別
  const handleImageProcess = useCallback(
    async (file: File, skipCropCheck = false) => {
      console.log('[OCR DEBUG] handleImageProcess: 開始處理', {
        fileName: file?.name,
        fileSize: file?.size,
        fileType: file?.type,
        isImage: file?.type.startsWith('image/'),
        skipCropCheck,
        timestamp: new Date().toISOString(),
      });

      if (!file || !file.type.startsWith('image/')) {
        console.warn('[OCR DEBUG] handleImageProcess: 檔案類型不符合', {
          fileType: file?.type,
          timestamp: new Date().toISOString(),
        });
        alert('請選擇圖片檔案！');
        return;
      }

      // 如果不是跳過裁剪檢查，直接進入裁剪模式
      if (!skipCropCheck) {
        // 所有圖片都進入裁剪模式
        setNeedsCrop(true);
        setOriginalImageFile(file);
        // 載入圖片以獲取尺寸
        const img = new Image();
        img.onload = () => {
          setOriginalImageSize({ width: img.width, height: img.height });
          URL.revokeObjectURL(img.src);
        };
        img.src = URL.createObjectURL(file);
        return;
      }

      console.log('[OCR DEBUG] handleImageProcess: 設置處理狀態', {
        timestamp: new Date().toISOString(),
      });
      setIsProcessing(true);
      setProgress(0);

      try {
        console.log('[OCR DEBUG] handleImageProcess: 調用 processImageForOCR', {
          timestamp: new Date().toISOString(),
        });
        const recognizedText = await processImageForOCR(file, (prog) => {
          console.log('[OCR DEBUG] handleImageProcess: 進度更新', {
            progress: prog,
            progressPercent: Math.round(prog * 100),
            timestamp: new Date().toISOString(),
          });
          setProgress(prog);
        });

        console.log('[OCR DEBUG] handleImageProcess: OCR 完成', {
          recognizedTextLength: recognizedText?.length || 0,
          recognizedText: recognizedText,
          hasOnTextRecognized: !!onTextRecognized,
          timestamp: new Date().toISOString(),
        });

        if (recognizedText && onTextRecognized) {
          console.log('[OCR DEBUG] handleImageProcess: 調用 onTextRecognized 回調', {
            text: recognizedText,
            timestamp: new Date().toISOString(),
          });
          onTextRecognized(recognizedText);
          setIsModalOpen(false);
          setPreviewImage(null);
          setNeedsCrop(false);
          setOriginalImageFile(null);
          setOriginalImageSize(null);
          setCropArea(null);
          setCropPreview(null);
          console.log('[OCR DEBUG] handleImageProcess: 關閉模態框並清除預覽', {
            timestamp: new Date().toISOString(),
          });
        } else {
          console.warn('[OCR DEBUG] handleImageProcess: 無法辨識文字或缺少回調', {
            hasRecognizedText: !!recognizedText,
            recognizedText,
            hasOnTextRecognized: !!onTextRecognized,
            timestamp: new Date().toISOString(),
          });
          alert('無法辨識圖片中的文字，請嘗試其他圖片。');
        }
      } catch (error) {
        console.error('[OCR DEBUG] handleImageProcess: OCR 失敗', {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        });
        alert('OCR 辨識失敗，請稍後再試');
      } finally {
        console.log('[OCR DEBUG] handleImageProcess: 清理狀態', {
          timestamp: new Date().toISOString(),
        });
        setIsProcessing(false);
        setProgress(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [onTextRecognized]
  );

  // 打開模態框
  const handleOCRClick = () => {
    console.log('[OCR DEBUG] handleOCRClick: OCR 按鈕點擊', {
      disabled,
      isProcessing,
      willOpenModal: !disabled && !isProcessing,
      timestamp: new Date().toISOString(),
    });

    if (!disabled && !isProcessing) {
      setIsModalOpen(true);
      console.log('[OCR DEBUG] handleOCRClick: 模態框已打開', {
        timestamp: new Date().toISOString(),
      });
    }
  };

  // 關閉模態框
  const handleCloseModal = () => {
    console.log('[OCR DEBUG] handleCloseModal: 關閉模態框', {
      isProcessing,
      willClose: !isProcessing,
      timestamp: new Date().toISOString(),
    });

    if (!isProcessing) {
      setIsModalOpen(false);
      setPreviewImage(null);
      setIsDragging(false);
      setNeedsCrop(false);
      setOriginalImageFile(null);
      setOriginalImageSize(null);
      setCropArea(null);
      setCropPreview(null);
      console.log('[OCR DEBUG] handleCloseModal: 模態框已關閉', {
        timestamp: new Date().toISOString(),
      });
    }
  };

  // 生成裁剪預覽
  const generateCropPreview = useCallback(async (area: CropArea) => {
    if (!previewImage || !imageRef.current || !cropContainerRef.current) return;
    
    try {
      const img = new Image();
      img.src = previewImage;
      
      await new Promise((resolve) => {
        if (img.complete) {
          resolve(null);
        } else {
          img.onload = () => resolve(null);
        }
      });

      const containerRect = cropContainerRef.current.getBoundingClientRect();
      const imgRect = imageRef.current.getBoundingClientRect();
      
      const displayX = imgRect.left - containerRect.left;
      const displayY = imgRect.top - containerRect.top;
      const displayWidth = imgRect.width;
      const displayHeight = imgRect.height;
      
      const scaleX = img.width / displayWidth;
      const scaleY = img.height / displayHeight;
      
      const relativeX = area.x - displayX;
      const relativeY = area.y - displayY;
      
      const actualX = Math.max(0, Math.min(img.width, relativeX * scaleX));
      const actualY = Math.max(0, Math.min(img.height, relativeY * scaleY));
      const actualWidth = Math.max(0, Math.min(img.width - actualX, area.width * scaleX));
      const actualHeight = Math.max(0, Math.min(img.height - actualY, area.height * scaleY));
      
      if (actualWidth <= 0 || actualHeight <= 0) {
        setCropPreview(null);
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      // 放大倍數（2-3倍）
      const zoomFactor = 2.5;
      canvas.width = actualWidth * zoomFactor;
      canvas.height = actualHeight * zoomFactor;
      
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        img,
        actualX, actualY, actualWidth, actualHeight,
        0, 0, canvas.width, canvas.height
      );
      
      setCropPreview(canvas.toDataURL('image/png'));
    } catch (error) {
      console.error('[OCR DEBUG] generateCropPreview: 生成預覽失敗', error);
      setCropPreview(null);
    }
  }, [previewImage]);

  // 裁剪相關處理函數
  const handleCropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current || !cropContainerRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = cropContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDraggingCrop(true);
    setCropStartPos({ x, y });
    setCropArea({ x, y, width: 0, height: 0 });
    setCropPreview(null);
  };

  const handleCropMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingCrop || !cropStartPos || !cropContainerRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = cropContainerRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    const x = Math.min(cropStartPos.x, currentX);
    const y = Math.min(cropStartPos.y, currentY);
    const width = Math.abs(currentX - cropStartPos.x);
    const height = Math.abs(currentY - cropStartPos.y);
    
    const newArea = { x, y, width, height };
    setCropArea(newArea);
    
    // 當有有效區域時生成預覽
    if (width > 10 && height > 10) {
      generateCropPreview(newArea);
    } else {
      setCropPreview(null);
    }
  };

  const handleCropMouseUp = () => {
    setIsDraggingCrop(false);
    setCropStartPos(null);
    // 確保最終預覽已生成
    if (cropArea && cropArea.width > 10 && cropArea.height > 10) {
      generateCropPreview(cropArea);
    }
  };

  // 預覽區域拖曳處理
  const handlePreviewMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cropArea || !previewRef.current || !cropContainerRef.current || !imageRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsDraggingPreview(true);
    setPreviewDragStart({ x: e.clientX, y: e.clientY });
  };

  const handlePreviewMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingPreview || !previewDragStart || !cropArea || !previewRef.current || !cropContainerRef.current || !imageRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // 計算拖曳距離
    const deltaX = e.clientX - previewDragStart.x;
    const deltaY = e.clientY - previewDragStart.y;
    
    // 計算預覽圖片和原始圖片的比例
    // 預覽是2.5倍放大，所以需要除以2.5來還原到原始尺寸
    const zoomFactor = 2.5;
    const scaleX = deltaX / zoomFactor;
    const scaleY = deltaY / zoomFactor;
    
    // 使用函數式更新確保使用最新的cropArea值
    setCropArea((prevArea) => {
      if (!prevArea || !cropContainerRef.current || !imageRef.current) return prevArea;
      
      // 計算原始圖片在容器中的顯示位置和尺寸
      const containerRect = cropContainerRef.current.getBoundingClientRect();
      const imgRect = imageRef.current.getBoundingClientRect();
      
      const displayX = imgRect.left - containerRect.left;
      const displayY = imgRect.top - containerRect.top;
      
      // 更新裁剪區域位置（反向移動，因為預覽中往左拖，裁剪區域也往左）
      const newX = prevArea.x - scaleX;
      const newY = prevArea.y - scaleY;
      
      // 確保裁剪區域不會超出圖片範圍
      const constrainedX = Math.max(displayX, Math.min(newX, displayX + imgRect.width - prevArea.width));
      const constrainedY = Math.max(displayY, Math.min(newY, displayY + imgRect.height - prevArea.height));
      
      return {
        ...prevArea,
        x: constrainedX,
        y: constrainedY,
      };
    });
    
    // 更新拖曳起始位置
    setPreviewDragStart({ x: e.clientX, y: e.clientY });
  };

  const handlePreviewMouseUp = () => {
    setIsDraggingPreview(false);
    setPreviewDragStart(null);
    // 更新預覽
    if (cropArea && cropArea.width > 10 && cropArea.height > 10) {
      generateCropPreview(cropArea);
    }
  };

  // 當裁剪區域改變且不在拖動時，更新預覽
  useEffect(() => {
    if (!isDraggingCrop && cropArea && cropArea.width > 10 && cropArea.height > 10 && needsCrop) {
      const timer = setTimeout(() => {
        generateCropPreview(cropArea);
      }, 100); // 防抖，避免頻繁更新
      return () => clearTimeout(timer);
    }
  }, [cropArea, isDraggingCrop, needsCrop, generateCropPreview]);

  // 確認裁剪（或使用原圖）
  const handleConfirmCrop = useCallback(async () => {
    if (!originalImageFile) {
      alert('請先上傳圖片');
      return;
    }

    try {
      setIsProcessing(true);
      
      // 如果有選擇裁剪區域，使用裁剪後的圖片；否則使用原圖
      if (cropArea && cropArea.width > 0 && cropArea.height > 0) {
        const croppedFile = await cropImage(originalImageFile, cropArea);
        setNeedsCrop(false);
        setCropArea(null);
        setCropPreview(null);
        await handleImageProcess(croppedFile, true);
      } else {
        // 沒有選擇裁剪區域，直接使用原圖
        setNeedsCrop(false);
        setCropArea(null);
        setCropPreview(null);
        await handleImageProcess(originalImageFile, true);
      }
    } catch (error) {
      console.error('[OCR DEBUG] handleConfirmCrop: 處理失敗', {
        error,
        timestamp: new Date().toISOString(),
      });
      alert('處理失敗，請重試');
      setIsProcessing(false);
    }
  }, [originalImageFile, cropArea, cropImage, handleImageProcess]);

  // 二度裁剪：將當前裁剪區域作為新圖片進行再次裁剪
  const handleRecrop = useCallback(async () => {
    if (!originalImageFile || !cropArea || cropArea.width === 0 || cropArea.height === 0) {
      alert('請先選擇要裁剪的區域');
      return;
    }

    try {
      // 裁剪當前選擇的區域
      const croppedFile = await cropImage(originalImageFile, cropArea);
      
      // 將裁剪後的圖片作為新的原始圖片
      setOriginalImageFile(croppedFile);
      
      // 更新預覽圖片
      const reader = new FileReader();
      reader.onload = async (e) => {
        const newPreviewImage = e.target?.result as string;
        setPreviewImage(newPreviewImage);
        
        // 重置裁剪區域，讓用戶可以重新選擇
        setCropArea(null);
        setCropPreview(null);
        
        // 獲取新圖片的尺寸
        const img = new Image();
        img.onload = () => {
          // 無論圖片大小，都保持裁剪模式，讓用戶可以再次選擇裁剪區域
          setOriginalImageSize({ width: img.width, height: img.height });
          setNeedsCrop(true);
          
          // 確保圖片已載入到imageRef
          setTimeout(() => {
            if (imageRef.current) {
              imageRef.current.src = newPreviewImage;
            }
          }, 100);
        };
        img.onerror = () => {
          console.error('[OCR DEBUG] handleRecrop: 圖片載入失敗');
          alert('圖片載入失敗，請重試');
        };
        img.src = newPreviewImage;
      };
      reader.onerror = () => {
        console.error('[OCR DEBUG] handleRecrop: FileReader 失敗');
        alert('讀取圖片失敗，請重試');
      };
      reader.readAsDataURL(croppedFile);
    } catch (error) {
      console.error('[OCR DEBUG] handleRecrop: 二度裁剪失敗', {
        error,
        timestamp: new Date().toISOString(),
      });
      alert('二度裁剪失敗，請重試');
    }
  }, [originalImageFile, cropArea, cropImage]);

  // 處理文件選擇
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[OCR DEBUG] handleFileChange: 文件選擇事件觸發', {
      fileCount: e.target.files?.length || 0,
      timestamp: new Date().toISOString(),
    });

    const file = e.target.files?.[0];
    if (file) {
      console.log('[OCR DEBUG] handleFileChange: 開始處理選取的檔案', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        timestamp: new Date().toISOString(),
      });

      // 顯示預覽
      const reader = new FileReader();
      reader.onload = (e) => {
        console.log('[OCR DEBUG] handleFileChange: 預覽圖片載入完成', {
          resultLength: (e.target?.result as string)?.length,
          timestamp: new Date().toISOString(),
        });
        setPreviewImage(e.target?.result as string);
      };
      reader.onerror = (error) => {
        console.error('[OCR DEBUG] handleFileChange: 預覽圖片載入失敗', {
          error,
          timestamp: new Date().toISOString(),
        });
      };
      reader.readAsDataURL(file);
      await handleImageProcess(file);
    } else {
      console.warn('[OCR DEBUG] handleFileChange: 沒有選取檔案', {
        timestamp: new Date().toISOString(),
      });
    }
  };

  // 處理拖拽
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    console.log('[OCR DEBUG] handleDrop: 拖放事件觸發', {
      fileCount: e.dataTransfer.files.length,
      timestamp: new Date().toISOString(),
    });

    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      console.log('[OCR DEBUG] handleDrop: 處理拖放的檔案', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        isImage: file.type.startsWith('image/'),
        timestamp: new Date().toISOString(),
      });

      if (file.type.startsWith('image/')) {
        // 顯示預覽
        const reader = new FileReader();
        reader.onload = (e) => {
          console.log('[OCR DEBUG] handleDrop: 預覽圖片載入完成', {
            resultLength: (e.target?.result as string)?.length,
            timestamp: new Date().toISOString(),
          });
          setPreviewImage(e.target?.result as string);
        };
        reader.readAsDataURL(file);
        await handleImageProcess(file);
      } else {
        console.warn('[OCR DEBUG] handleDrop: 檔案類型不符合', {
          fileType: file.type,
          timestamp: new Date().toISOString(),
        });
        alert('請拖放圖片檔案！');
      }
    } else {
      console.warn('[OCR DEBUG] handleDrop: 沒有檔案', {
        timestamp: new Date().toISOString(),
      });
    }
  };

  // 處理剪貼簿貼上
  useEffect(() => {
    if (!isModalOpen) return;

    const handlePaste = async (e: ClipboardEvent) => {
      console.log('[OCR DEBUG] handlePaste: 剪貼簿貼上事件觸發', {
        hasClipboardData: !!e.clipboardData,
        timestamp: new Date().toISOString(),
      });

      e.preventDefault();
      const clipboardData = e.clipboardData || (window as any).clipboardData;
      if (!clipboardData) {
        console.warn('[OCR DEBUG] handlePaste: 無法取得剪貼簿資料', {
          timestamp: new Date().toISOString(),
        });
        alert('無法讀取剪貼簿內容，請確認瀏覽器權限設定。');
        return;
      }

      // 先檢查剪貼簿中是否有圖片
      const itemsArray = Array.from(clipboardData.items) as DataTransferItem[];
      const hasImage = itemsArray.some(
        (item) => item.type.indexOf('image') !== -1
      );

      if (!hasImage) {
        console.warn('[OCR DEBUG] handlePaste: 剪貼簿中沒有圖片', {
          itemCount: clipboardData.items.length,
          itemTypes: itemsArray.map((item) => item.type),
          timestamp: new Date().toISOString(),
        });
        alert('剪貼簿中沒有圖片！\n\n請先複製圖片（例如：截圖、從網頁右鍵複製圖片、或從圖片編輯軟體複製），然後再貼上。');
        return;
      }

      try {
        console.log('[OCR DEBUG] handlePaste: 開始從剪貼簿載入圖片', {
          timestamp: new Date().toISOString(),
        });
        const img = await loadImageFromClipboard(clipboardData);
        console.log('[OCR DEBUG] handlePaste: 圖片載入成功，開始轉換為 File', {
          width: img.width,
          height: img.height,
          timestamp: new Date().toISOString(),
        });

        // 將 Image 轉換為 File
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);

        console.log('[OCR DEBUG] handlePaste: 開始轉換 Canvas 為 Blob', {
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          timestamp: new Date().toISOString(),
        });

        canvas.toBlob(
          async (blob) => {
            if (blob) {
              console.log('[OCR DEBUG] handlePaste: Blob 轉換成功', {
                blobSize: blob.size,
                blobType: blob.type,
                timestamp: new Date().toISOString(),
              });

              const file = new File([blob], 'pasted-image.png', {
                type: 'image/png',
              });
              setPreviewImage(img.src);
              await handleImageProcess(file);
            } else {
              console.error('[OCR DEBUG] handlePaste: Blob 轉換失敗', {
                timestamp: new Date().toISOString(),
              });
              alert('無法處理剪貼簿中的圖片，請嘗試其他圖片或使用檔案上傳功能。');
            }
          },
          'image/png',
          1
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[OCR DEBUG] handlePaste: 剪貼簿處理失敗', {
          error,
          errorMessage,
          errorStack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        });

        // 根據錯誤類型顯示不同的提示訊息
        if (errorMessage.includes('剪貼簿中沒有圖片') || errorMessage.includes('無法讀取剪貼簿圖片')) {
          alert('無法讀取剪貼簿中的圖片！\n\n請確認：\n1. 已正確複製圖片（不是文字或其他內容）\n2. 圖片格式支援（JPG、PNG、GIF 等）\n3. 瀏覽器允許讀取剪貼簿權限');
        } else if (errorMessage.includes('Image onerror') || errorMessage.includes('載入失敗')) {
          alert('圖片載入失敗！\n\n請確認圖片格式正確，或嘗試使用檔案上傳功能。');
        } else {
          alert('處理剪貼簿內容時發生錯誤：' + errorMessage + '\n\n請嘗試使用檔案上傳功能。');
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [isModalOpen, handleImageProcess]);

  // 點擊背景關閉模態框
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // 點擊背景遮罩時關閉（排除模態框內容區域）
    if (e.target === e.currentTarget && !isProcessing) {
      handleCloseModal();
    }
  };

  // 注入簡單的邊框特效樣式
  useEffect(() => {
    const styleId = 'ocr-crop-border-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .ocr-crop-container {
          position: relative;
          border: 2px solid #fbbf24 !important;
          box-shadow: 0 0 10px rgba(251, 191, 36, 0.5),
                      0 0 20px rgba(251, 191, 36, 0.3),
                      inset 0 0 10px rgba(251, 191, 36, 0.1);
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // 監聽 Enter 鍵觸發開始搜尋
  useEffect(() => {
    if (!isModalOpen || !needsCrop || isProcessing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果用戶正在輸入框中輸入，不觸發
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleConfirmCrop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen, needsCrop, isProcessing, handleConfirmCrop]);

  // 當模態框打開/關閉時，鎖定/解鎖背景滾動
  useEffect(() => {
    if (isModalOpen) {
      // 保存當前滾動位置
      const scrollY = window.scrollY;
      // 鎖定背景滾動
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      return () => {
        // 恢復滾動
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isModalOpen]);

  // 全局預覽拖曳處理（確保鼠標移出預覽區域時也能繼續拖曳）
  useEffect(() => {
    if (isDraggingPreview && previewDragStart) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        if (!cropContainerRef.current || !imageRef.current) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        // 計算拖曳距離
        const deltaX = e.clientX - previewDragStart.x;
        const deltaY = e.clientY - previewDragStart.y;
        
        // 計算預覽圖片和原始圖片的比例
        const zoomFactor = 2.5;
        const scaleX = deltaX / zoomFactor;
        const scaleY = deltaY / zoomFactor;
        
        // 使用函數式更新確保使用最新的cropArea值
        setCropArea((prevArea) => {
          if (!prevArea || !cropContainerRef.current || !imageRef.current) return prevArea;
          
          // 計算原始圖片在容器中的顯示位置和尺寸
          const containerRect = cropContainerRef.current.getBoundingClientRect();
          const imgRect = imageRef.current.getBoundingClientRect();
          
          const displayX = imgRect.left - containerRect.left;
          const displayY = imgRect.top - containerRect.top;
          
          // 更新裁剪區域位置（反向移動）
          const newX = prevArea.x - scaleX;
          const newY = prevArea.y - scaleY;
          
          // 確保裁剪區域不會超出圖片範圍
          const constrainedX = Math.max(displayX, Math.min(newX, displayX + imgRect.width - prevArea.width));
          const constrainedY = Math.max(displayY, Math.min(newY, displayY + imgRect.height - prevArea.height));
          
          return {
            ...prevArea,
            x: constrainedX,
            y: constrainedY,
          };
        });
        
        // 更新拖曳起始位置
        setPreviewDragStart({ x: e.clientX, y: e.clientY });
      };

      const handleGlobalMouseUp = () => {
        setIsDraggingPreview(false);
        setPreviewDragStart(null);
        // 更新預覽
        setCropArea((prevArea) => {
          if (prevArea && prevArea.width > 10 && prevArea.height > 10) {
            generateCropPreview(prevArea);
          }
          return prevArea;
        });
      };

      window.addEventListener('mousemove', handleGlobalMouseMove, { passive: false });
      window.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDraggingPreview, previewDragStart, generateCropPreview]);

  // 在裁剪模式下禁用拖曳滾動（但保留滾輪滾動）
  useEffect(() => {
    if (needsCrop && isModalOpen) {
      const handleMouseDown = (e: MouseEvent) => {
        // 只在非裁剪容器區域和非預覽區域禁用拖曳滾動
        const target = e.target as HTMLElement;
        if (cropContainerRef.current && !cropContainerRef.current.contains(target) &&
            previewRef.current && !previewRef.current.contains(target)) {
          // 禁用拖曳滾動
          if (e.button === 0) {
            e.preventDefault();
          }
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        // 只在拖動裁剪時禁用觸摸移動
        if (isDraggingCrop) {
          e.preventDefault();
          e.stopPropagation();
        }
      };

      const handleDragStart = (e: DragEvent) => {
        // 禁用拖曳開始（防止拖動圖片等）
        if (isDraggingCrop || (e.target as HTMLElement)?.tagName === 'IMG') {
          e.preventDefault();
          e.stopPropagation();
        }
      };

      // 禁用拖曳滾動（按住滑鼠拖動）
      document.addEventListener('mousedown', handleMouseDown, { passive: false });
      // 禁用觸摸移動（防止移動端拖動）
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      // 禁用拖曳開始
      window.addEventListener('dragstart', handleDragStart, { passive: false });
      document.addEventListener('dragstart', handleDragStart, { passive: false });

      return () => {
        document.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('dragstart', handleDragStart);
        document.removeEventListener('dragstart', handleDragStart);
      };
    }
  }, [needsCrop, isModalOpen, isDraggingCrop]);

  // 模態框內容
  const modalContent = isModalOpen ? (
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      onMouseDown={(e) => {
        // 禁用背景拖曳滾動
        if (needsCrop && e.button === 0 && e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
      onTouchMove={(e) => {
        // 只在拖動裁剪時禁用觸摸移動
        if (needsCrop && isDraggingCrop) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 10000,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out',
        overflow: 'auto',
        // 只在拖動裁剪時禁用觸摸操作
        touchAction: needsCrop && isDraggingCrop ? 'none' : 'auto',
      }}
    >
      {/* 模態框主容器 */}
      <div
        className="bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 rounded-lg border-2 border-purple-500/50 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => {
          // 禁用拖曳滾動
          if (needsCrop && e.button === 0) {
            const target = e.target as HTMLElement;
            if (!cropContainerRef.current?.contains(target)) {
              e.preventDefault();
            }
          }
        }}
        style={{
          width: 'min(calc(100% - 2rem), 42rem)',
          minWidth: '20rem',
          maxHeight: '90vh',
          animation: 'slideInScale 0.3s ease-out',
        }}
      >
        {/* 標題欄 */}
        <div className="flex flex-col p-2 sm:p-3 border-b border-purple-500/30 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base sm:text-lg font-semibold text-white">OCR 圖片識別</h2>
            <button
              onClick={handleCloseModal}
              disabled={isProcessing}
              className="text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed p-1 rounded hover:bg-gray-800/50"
              aria-label="關閉"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* 說明文字 */}
          {needsCrop ? (
            <div className="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-500/30 rounded-lg px-3 py-1.5">
              <div className="flex items-center gap-3 text-center sm:text-left">
                <p className="text-sm text-white font-medium whitespace-nowrap">請選擇要識別的區域</p>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-500/30 rounded-lg px-3 py-1.5">
              <div className="flex items-center gap-3 text-center sm:text-left">
                <p className="text-sm text-white font-medium whitespace-nowrap">
                  <span className="text-purple-300">光之戰士</span>，懶得打字？
                </p>
                <p className="text-xs text-gray-300 whitespace-nowrap">
                  直接截圖物品名稱，讓 OCR 幫你識別！
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 內容區域（可滾動） */}
        <div 
          className={`flex-1 overflow-y-auto min-h-0 ${needsCrop ? 'p-2 sm:p-3' : 'p-4 sm:p-6'}`}
          onMouseDown={(e) => {
            // 禁用拖曳滾動（按住滑鼠拖動滾動）
            if (needsCrop && e.button === 0) {
              // 只在非裁剪容器區域禁用拖曳滾動
              const target = e.target as HTMLElement;
              if (!cropContainerRef.current?.contains(target)) {
                e.preventDefault();
              }
            }
          }}
          style={{
            // 禁用拖曳滾動，但保留滾輪滾動
            userSelect: needsCrop ? 'none' : 'auto',
          }}
        >
          {/* 拖放區域 */}
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isProcessing && !needsCrop && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg text-center transition-all w-full box-border ${
              needsCrop
                ? 'border-transparent cursor-default p-0'
                : `cursor-pointer p-6 sm:p-8 ${
                    isDragging
                      ? 'border-purple-400 bg-purple-900/20'
                      : 'border-purple-500/50 hover:border-purple-400 hover:bg-purple-900/10'
                  } ${isProcessing ? 'cursor-not-allowed opacity-50' : ''}`
            }`}
          >
            {previewImage ? (
              /* 預覽圖片狀態 */
              <div className={`w-full ${needsCrop ? 'space-y-2' : 'space-y-4'}`}>
                {needsCrop ? (
                  /* 裁剪模式 */
                  <div className="w-full">
                    <p className="text-xs text-gray-400 mb-1 text-center">原圖 - 拖動滑鼠選擇區域</p>
                    <div
                      ref={cropContainerRef}
                      className="ocr-crop-container relative mx-auto rounded-lg bg-black/20"
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '60vh', 
                        cursor: 'crosshair', 
                        touchAction: 'none',
                        overflow: 'hidden',
                      }}
                      onMouseDown={(e) => {
                        // 允許裁剪區域的滑鼠操作
                        handleCropMouseDown(e);
                      }}
                      onMouseMove={handleCropMouseMove}
                      onMouseUp={handleCropMouseUp}
                      onMouseLeave={handleCropMouseUp}
                      onTouchStart={(e) => {
                        if (e.touches.length === 1 && cropContainerRef.current) {
                          e.preventDefault();
                          e.stopPropagation();
                          const touch = e.touches[0];
                          const rect = cropContainerRef.current.getBoundingClientRect();
                          const syntheticEvent = {
                            clientX: touch.clientX,
                            clientY: touch.clientY,
                            preventDefault: () => {},
                            stopPropagation: () => {},
                            currentTarget: cropContainerRef.current,
                          } as React.MouseEvent<HTMLDivElement>;
                          handleCropMouseDown(syntheticEvent);
                        }
                      }}
                      onTouchMove={(e) => {
                        if (isDraggingCrop && e.touches.length === 1 && cropContainerRef.current) {
                          e.preventDefault();
                          e.stopPropagation();
                          const touch = e.touches[0];
                          const syntheticEvent = {
                            clientX: touch.clientX,
                            clientY: touch.clientY,
                            preventDefault: () => {},
                            stopPropagation: () => {},
                            currentTarget: cropContainerRef.current,
                          } as React.MouseEvent<HTMLDivElement>;
                          handleCropMouseMove(syntheticEvent);
                        }
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCropMouseUp();
                      }}
                    >
                      <div className="relative overflow-hidden rounded-lg">
                        <img
                          ref={imageRef}
                          src={previewImage}
                          alt="預覽"
                          className="max-w-full max-h-[60vh] mx-auto block object-contain select-none"
                          draggable={false}
                          style={{ userSelect: 'none', pointerEvents: 'none' }}
                        />
                      </div>
                      {cropArea && cropArea.width > 0 && cropArea.height > 0 && (
                        <>
                          {/* 遮罩層 - 使用四個div來實現遮罩效果 */}
                          <div
                            className="absolute bg-black/60 pointer-events-none"
                            style={{
                              left: 0,
                              top: 0,
                              width: `${cropArea.x}px`,
                              height: '100%',
                            }}
                          />
                          <div
                            className="absolute bg-black/60 pointer-events-none"
                            style={{
                              left: `${cropArea.x + cropArea.width}px`,
                              top: 0,
                              right: 0,
                              height: '100%',
                            }}
                          />
                          <div
                            className="absolute bg-black/60 pointer-events-none"
                            style={{
                              left: `${cropArea.x}px`,
                              top: 0,
                              width: `${cropArea.width}px`,
                              height: `${cropArea.y}px`,
                            }}
                          />
                          <div
                            className="absolute bg-black/60 pointer-events-none"
                            style={{
                              left: `${cropArea.x}px`,
                              top: `${cropArea.y + cropArea.height}px`,
                              width: `${cropArea.width}px`,
                              bottom: 0,
                            }}
                          />
                          {/* 裁剪選擇框 */}
                          <div
                            className="absolute border-2 border-ffxiv-gold/60 bg-ffxiv-gold/10 pointer-events-none"
                            style={{
                              left: `${cropArea.x}px`,
                              top: `${cropArea.y}px`,
                              width: `${cropArea.width}px`,
                              height: `${cropArea.height}px`,
                              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                            }}
                          />
                        </>
                      )}
                    </div>
                    {/* 預覽和按鈕布局 */}
                    {needsCrop && (
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-4">
                        {/* 中間：預覽框容器 - 獨立居中 */}
                        <div className="flex-shrink-0 min-w-0 justify-self-center sm:col-start-2 sm:col-end-3">
                          <div className="space-y-2">
                            <p className="text-xs text-gray-400 text-center">
                              {cropPreview && cropArea && cropArea.width > 10 && cropArea.height > 10
                                ? '放大預覽（2.5x）- 可拖曳調整位置'
                                : '放大預覽（2.5x）'}
                            </p>
                            <div className="flex justify-center">
                              <div
                                ref={previewRef}
                                className="relative border-2 border-purple-400/50 rounded-lg overflow-hidden bg-black/30"
                                onMouseDown={cropPreview && cropArea && cropArea.width > 10 && cropArea.height > 10 ? handlePreviewMouseDown : undefined}
                                onMouseMove={cropPreview && cropArea && cropArea.width > 10 && cropArea.height > 10 ? handlePreviewMouseMove : undefined}
                                onMouseUp={cropPreview && cropArea && cropArea.width > 10 && cropArea.height > 10 ? handlePreviewMouseUp : undefined}
                                onMouseLeave={cropPreview && cropArea && cropArea.width > 10 && cropArea.height > 10 ? handlePreviewMouseUp : undefined}
                                style={{
                                  cursor: cropPreview && cropArea && cropArea.width > 10 && cropArea.height > 10
                                    ? (isDraggingPreview ? 'grabbing' : 'grab')
                                    : 'default',
                                  userSelect: 'none',
                                  minHeight: '192px', // 約 max-h-48 的高度
                                  minWidth: '200px',
                                  maxWidth: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {cropPreview && cropArea && cropArea.width > 10 && cropArea.height > 10 ? (
                                  <img
                                    src={cropPreview}
                                    alt="裁剪預覽"
                                    className="max-w-full max-h-48 block pointer-events-none select-none"
                                    draggable={false}
                                  />
                                ) : (
                                  <p className="text-xs text-gray-500 text-center px-4">請選擇要裁剪的區域</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* 右側：按鈕 */}
                        <div className="flex flex-col gap-2 flex-shrink-0 justify-center w-full sm:w-auto sm:col-start-3 sm:col-end-4 justify-self-center sm:justify-self-start">
                          <button
                            onClick={handleConfirmCrop}
                            disabled={isProcessing}
                            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap w-full sm:w-auto flex items-center gap-2 justify-center"
                          >
                            <span>開始搜尋</span>
                            <kbd className="px-1 py-0.5 bg-white/20 rounded text-[10px] border border-white/30 font-mono leading-none">
                              ⏎
                            </kbd>
                          </button>
                          <button
                            onClick={handleRecrop}
                            disabled={!cropArea || cropArea.width === 0 || cropArea.height === 0 || isProcessing}
                            className="px-4 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap w-full sm:w-auto flex items-center gap-1.5 justify-center"
                          >
                            <span>二度裁剪</span>
                            <kbd className="px-1 py-0.5 bg-white/20 rounded text-[10px] border border-white/30 leading-none flex items-center justify-center">
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                {/* 左上角：兩個重疊的 L 形 */}
                                <path d="M2 2h6v6H2V2z" />
                                <path d="M2 2h8M2 2v8" />
                                {/* 右上角：L 形 */}
                                <path d="M22 2h-6v6h6V2z" />
                                {/* 左下角：L 形 */}
                                <path d="M2 22h6v-6H2v6z" />
                                {/* 右下角：兩個重疊的 L 形 */}
                                <path d="M22 22h-6v-6h6v6z" />
                                <path d="M22 22h-8M22 22v-8" />
                              </svg>
                            </kbd>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* 正常預覽 */
                  <>
                    <img
                      src={previewImage}
                      alt="預覽"
                      className="max-w-full max-h-64 mx-auto rounded-lg shadow-lg object-contain"
                    />
                    {isProcessing && (
                      /* 進度條 */
                      <div className="space-y-2 w-full">
                        <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-purple-500 h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${progress * 100}%` }}
                          />
                        </div>
                        <p className="text-sm text-gray-400">辨識中... {Math.round(progress * 100)}%</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              /* 空狀態（未選擇圖片） */
              <div className="space-y-4 w-full flex flex-col items-center">
                <svg
                  className="w-16 h-16 sm:w-20 sm:h-20 text-purple-400 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <div className="w-full text-center">
                  <p className="text-white font-medium mb-2 text-sm sm:text-base">點擊或拖放圖片到此處</p>
                  <p className="text-xs sm:text-sm text-gray-400 mb-2">
                    或使用{' '}
                    <kbd className="px-2 py-1 bg-slate-800 rounded text-xs border border-slate-700">Ctrl</kbd>
                    /
                    <kbd className="px-2 py-1 bg-slate-800 rounded text-xs border border-slate-700">Cmd</kbd>
                    {' '}+{' '}
                    <kbd className="px-2 py-1 bg-slate-800 rounded text-xs border border-slate-700">V</kbd>
                    {' '}貼上剪貼簿圖片
                  </p>
                  <p className="text-xs text-gray-500 mb-2">支援 JPG、PNG、GIF 等圖片格式</p>
                  <p className="text-xs text-purple-300 font-medium">
                    💡 截圖範圍越精確，效果越好
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 提示文字 */}
          {!isProcessing && (
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">僅支援繁體中文識別</p>
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* OCR 主按鈕 */}
      <button
        onClick={handleOCRClick}
        disabled={disabled || isProcessing}
        className="flex items-center justify-center gap-1.5 px-2.5 mid:px-3 py-1.5 mid:py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs mid:text-sm font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
        title="上傳圖片進行 OCR 辨識（繁體中文）"
      >
        {isProcessing ? (
          <>
            {/* 載入中：左邊 spinner，右邊百分比 */}
            <div className="animate-spin rounded-full h-3 w-3 mid:h-3.5 mid:w-3.5 border-2 border-white border-t-transparent flex-shrink-0"></div>
            <span className="hidden mid:inline whitespace-nowrap">{Math.round(progress * 100)}%</span>
          </>
        ) : (
          <>
            {/* 正常狀態：左邊 icon，右邊文字 */}
            <svg
              className="w-3.5 h-3.5 mid:w-4 mid:h-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="hidden mid:inline whitespace-nowrap">截圖搜尋</span>
          </>
        )}
      </button>

      {/* 使用 Portal 將模態框渲染到 body */}
      {isModalOpen && createPortal(modalContent, document.body)}

      {/* 隱藏的文件輸入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </>
  );
}
