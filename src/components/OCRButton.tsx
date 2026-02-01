import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getTwItems } from '../services/supabaseData';
import { cropBlackBorders } from '../utils/ocr/imageUtils';
import { getTesseractConfig, ocrDebugLog, TESSERACT_INIT_CONFIG, type TesseractFiltersConfig } from '../utils/ocr/tesseractConfig';

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

// 使用統一 Tesseract 設定（可透過 window.__TESSERACT_CONFIG__ 覆寫以調試）
const getConfig = () => getTesseractConfig();

// 緩存 itemtw 字符白名單（首次使用時構建）
let itemtwCharWhitelist: string | null = null;
let whitelistBuildPromise: Promise<string> | null = null;

// 緩存 bigram/trigram 白名單
interface WhitelistCache {
  charSet: Set<string>;
  bigramSet: Set<string>;
  trigramSet: Set<string>;
}
let itemtwWhitelistCache: WhitelistCache | null = null;


/**
 * 讀入圖片檔案為 Image 物件
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  ocrDebugLog('loadImage: 開始載入圖片', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    timestamp: new Date().toISOString(),
  });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      ocrDebugLog('loadImage: FileReader onload 成功', {
        resultLength: (e.target?.result as string)?.length,
        timestamp: new Date().toISOString(),
      });

      const img = new Image();
      img.onload = () => {
        ocrDebugLog('loadImage: Image onload 成功', {
          width: img.width,
          height: img.height,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          timestamp: new Date().toISOString(),
        });
        resolve(img);
      };
      img.onerror = (error) => {
        ocrDebugLog('loadImage: Image onerror', {
          error,
          timestamp: new Date().toISOString(),
        });
        reject(error);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = (error) => {
      ocrDebugLog('loadImage: FileReader onerror', {
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
  ocrDebugLog('resizeImageIfNeeded: 開始檢查圖片尺寸', {
    width: image.width,
    height: image.height,
    maxDimension: getConfig().maxImageDimension,
    timestamp: new Date().toISOString(),
  });

  return new Promise((resolve) => {
    const maxDim = getConfig().maxImageDimension;
    const { width, height } = image;

    if (width <= maxDim && height <= maxDim) {
      ocrDebugLog('resizeImageIfNeeded: 圖片尺寸符合要求，無需縮放', {
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

    ocrDebugLog('resizeImageIfNeeded: 開始縮放圖片', {
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

    // 使用 filter 開關控制圖像平滑
    if (getConfig().filters.enableImageSmoothing) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    } else {
      ctx.imageSmoothingEnabled = false;
    }
    ctx.drawImage(image, 0, 0, newWidth, newHeight);

    const resizedImg = new Image();
    resizedImg.onload = () => {
      ocrDebugLog('resizeImageIfNeeded: 縮放完成', {
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
 * 支持更大的核尺寸以更好地平滑背景纹理
 */
function applyGaussianBlur(imageData: ImageData, radius = 1): ImageData {
  const { data, width, height } = imageData;
  const newData = new Uint8ClampedArray(data);
  
  // 根據radius選擇不同的高斯核
  let kernel: number[][];
  let kernelSum: number;
  let kernelRadius: number;
  
  if (radius === 1) {
    // 3x3 高斯核
    kernel = [
      [1, 2, 1],
      [2, 4, 2],
      [1, 2, 1]
    ];
    kernelSum = 16;
    kernelRadius = 1;
  } else if (radius === 2) {
    // 5x5 高斯核（更強的背景平滑）
    kernel = [
      [1, 4, 6, 4, 1],
      [4, 16, 24, 16, 4],
      [6, 24, 36, 24, 6],
      [4, 16, 24, 16, 4],
      [1, 4, 6, 4, 1]
    ];
    kernelSum = 256;
    kernelRadius = 2;
  } else {
    // 默認使用3x3
    kernel = [
      [1, 2, 1],
      [2, 4, 2],
      [1, 2, 1]
    ];
    kernelSum = 16;
    kernelRadius = 1;
  }

  for (let y = kernelRadius; y < height - kernelRadius; y++) {
    for (let x = kernelRadius; x < width - kernelRadius; x++) {
      let sum = 0;
      for (let dy = -kernelRadius; dy <= kernelRadius; dy++) {
        for (let dx = -kernelRadius; dx <= kernelRadius; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          const weight = kernel[dy + kernelRadius][dx + kernelRadius];
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
 * 去除細小網格線（針對背景紋理）
 * 通過檢測並平滑細線來去除網格干擾
 */
function removeGridLines(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const newData = new Uint8ClampedArray(data);
  
  // 使用更大的平滑核來去除細線
  const smoothRadius = 2;
  
  for (let y = smoothRadius; y < height - smoothRadius; y++) {
    for (let x = smoothRadius; x < width - smoothRadius; x++) {
      // 計算局部區域的平均值（用於平滑細線）
      let sum = 0;
      let count = 0;
      
      for (let dy = -smoothRadius; dy <= smoothRadius; dy++) {
        for (let dx = -smoothRadius; dx <= smoothRadius; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          sum += data[idx];
          count++;
        }
      }
      
      const avg = Math.round(sum / count);
      const idx = (y * width + x) * 4;
      const current = data[idx];
      
      // 如果當前像素與周圍平均值差異較小（可能是網格線），則平滑它
      const diff = Math.abs(current - avg);
      if (diff < 30) { // 閾值可調整
        newData[idx] = avg;
        newData[idx + 1] = avg;
        newData[idx + 2] = avg;
      } else {
        // 保留文字邊緣
        newData[idx] = current;
        newData[idx + 1] = current;
        newData[idx + 2] = current;
      }
    }
  }
  
  return new ImageData(newData, width, height);
}

/**
 * 雙邊濾波（保留邊緣的同時平滑背景）
 * 這對於去除網格紋理特別有效
 * 使用優化版本以提高性能
 */
function applyBilateralFilter(imageData: ImageData, radius = 2): ImageData {
  const { data, width, height } = imageData;
  const newData = new Uint8ClampedArray(data);
  
  const spatialSigma = radius * 0.8;
  const colorSigma = 40; // 顏色差異閾值（降低以更好地平滑網格）
  
  // 預計算空間權重表以提高性能
  const spatialWeights: number[][] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    spatialWeights[dy + radius] = [];
    for (let dx = -radius; dx <= radius; dx++) {
      const spatialDist = Math.sqrt(dx * dx + dy * dy);
      spatialWeights[dy + radius][dx + radius] = Math.exp(-(spatialDist * spatialDist) / (2 * spatialSigma * spatialSigma));
    }
  }
  
  // 預計算顏色權重表
  const colorWeightCache = new Map<number, number>();
  const getColorWeight = (colorDist: number): number => {
    if (!colorWeightCache.has(colorDist)) {
      colorWeightCache.set(colorDist, Math.exp(-(colorDist * colorDist) / (2 * colorSigma * colorSigma)));
    }
    return colorWeightCache.get(colorDist)!;
  };
  
  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      const centerIdx = (y * width + x) * 4;
      const centerValue = data[centerIdx];
      
      let weightedSum = 0;
      let weightSum = 0;
      
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const neighborIdx = ((y + dy) * width + (x + dx)) * 4;
          const neighborValue = data[neighborIdx];
          
          // 使用預計算的權重
          const spatialWeight = spatialWeights[dy + radius][dx + radius];
          const colorDist = Math.abs(centerValue - neighborValue);
          const colorWeight = getColorWeight(colorDist);
          
          const weight = spatialWeight * colorWeight;
          weightedSum += neighborValue * weight;
          weightSum += weight;
        }
      }
      
      const filteredValue = Math.round(weightedSum / weightSum);
      newData[centerIdx] = filteredValue;
      newData[centerIdx + 1] = filteredValue;
      newData[centerIdx + 2] = filteredValue;
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
 * 形態學閉運算（連接斷裂的筆畫）
 * 針對繁體字筆畫多的特點，閉運算可以連接因噪點或低分辨率而斷裂的筆畫
 */
function applyMorphologyClose(imageData: ImageData, kernelSize = 2): ImageData {
  const { data, width, height } = imageData;
  const newData = new Uint8ClampedArray(data);
  
  // 先進行膨脹（連接斷裂的筆畫）
  const dilated = new Uint8ClampedArray(data);
  for (let y = kernelSize; y < height - kernelSize; y++) {
    for (let x = kernelSize; x < width - kernelSize; x++) {
      let maxVal = 0;
      for (let dy = -kernelSize; dy <= kernelSize; dy++) {
        for (let dx = -kernelSize; dx <= kernelSize; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          maxVal = Math.max(maxVal, data[idx]);
        }
      }
      const idx = (y * width + x) * 4;
      dilated[idx] = maxVal;
      dilated[idx + 1] = maxVal;
      dilated[idx + 2] = maxVal;
    }
  }
  
  // 再進行腐蝕（恢復筆畫粗細，但保持連接）
  for (let y = kernelSize; y < height - kernelSize; y++) {
    for (let x = kernelSize; x < width - kernelSize; x++) {
      let minVal = 255;
      for (let dy = -kernelSize; dy <= kernelSize; dy++) {
        for (let dx = -kernelSize; dx <= kernelSize; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          minVal = Math.min(minVal, dilated[idx]);
        }
      }
      const idx = (y * width + x) * 4;
      newData[idx] = minVal;
      newData[idx + 1] = minVal;
      newData[idx + 2] = minVal;
    }
  }

  return new ImageData(newData, width, height);
}

/**
 * 銳化濾波（增強文字邊緣）
 * 針對繁體字筆畫多的特點，提供兩種強度的銳化
 */
function applySharpen(imageData: ImageData, strength: 'normal' | 'strong' = 'normal'): ImageData {
  const { data, width, height } = imageData;
  const newData = new Uint8ClampedArray(data);
  
  // 根據強度選擇不同的銳化核
  // 強銳化：更突出筆畫細節，適合繁體字筆畫多的情況
  const kernel = strength === 'strong' 
    ? [
        [0, -1, -1, -1, 0],
        [-1, -1, -1, -1, -1],
        [-1, -1, 13, -1, -1],
        [-1, -1, -1, -1, -1],
        [0, -1, -1, -1, 0]
      ]
    : [
        [0, -1, 0],
        [-1, 5, -1],
        [0, -1, 0]
      ];

  const kernelRadius = strength === 'strong' ? 2 : 1;

  for (let y = kernelRadius; y < height - kernelRadius; y++) {
    for (let x = kernelRadius; x < width - kernelRadius; x++) {
      let sum = 0;
      for (let dy = -kernelRadius; dy <= kernelRadius; dy++) {
        for (let dx = -kernelRadius; dx <= kernelRadius; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          const weight = strength === 'strong' 
            ? kernel[dy + kernelRadius][dx + kernelRadius]
            : kernel[dy + 1][dx + 1];
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
 * 檢測是否為淺色文字在深色背景上
 * 通過分析圖像的亮度分佈來判斷
 */
function detectLightTextOnDarkBackground(imageData: ImageData): boolean {
  const { data } = imageData;
  const brightnessValues: number[] = [];
  
  // 採樣圖像像素（每10個像素採樣一次以提高效率）
  for (let i = 0; i < data.length; i += 40) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    brightnessValues.push(gray);
  }
  
  // 計算平均亮度
  const avgBrightness = brightnessValues.reduce((a, b) => a + b, 0) / brightnessValues.length;
  
  // 計算亮度分佈（標準差）
  const variance = brightnessValues.reduce((sum, val) => sum + Math.pow(val - avgBrightness, 2), 0) / brightnessValues.length;
  const stdDev = Math.sqrt(variance);
  
  // 如果平均亮度低且標準差較大，可能是淺色文字在深色背景上
  // 平均亮度 < 120 且標準差 > 40 時，認為是淺色文字在深色背景
  const isLightText = avgBrightness < 120 && stdDev > 40;
  
  ocrDebugLog('detectLightTextOnDarkBackground: 檢測結果', {
    avgBrightness: Math.round(avgBrightness),
    stdDev: Math.round(stdDev),
    isLightText,
    timestamp: new Date().toISOString(),
  });
  
  return isLightText;
}

/**
 * 反轉圖像（用於淺色文字在深色背景的情況）
 */
function invertImage(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const newData = new Uint8ClampedArray(data);
  
  for (let i = 0; i < data.length; i += 4) {
    newData[i] = 255 - data[i];     // R
    newData[i + 1] = 255 - data[i + 1]; // G
    newData[i + 2] = 255 - data[i + 2]; // B
    newData[i + 3] = data[i + 3];   // A
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
  const brightnessValues: number[] = [];
  
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    sum += gray;
    count++;
    brightnessValues.push(gray);
  }
  const avgBrightness = sum / count;
  
  // 計算亮度分佈的標準差
  const variance = brightnessValues.reduce((sum, val) => sum + Math.pow(val - avgBrightness, 2), 0) / brightnessValues.length;
  const stdDev = Math.sqrt(variance);
  
  // 判斷是否為淺色文字在深色背景
  const isLightTextOnDark = avgBrightness < 120 && stdDev > 40;
  
  // 根據場景調整對比度參數
  let contrastFactor: number;
  let brightnessShift: number;
  
  if (isLightTextOnDark) {
    // 淺色文字在深色背景：適度的對比度增強（降低強度以避免筆畫黏連）
    contrastFactor = 2.2; // 從 3.0 降低到 2.2，避免過度增強
    brightnessShift = 15; // 從 30 降低到 15，減少亮度偏移
  } else if (avgBrightness < 100) {
    // 深色背景：中等對比度增強
    contrastFactor = 2.0; // 從 2.5 降低到 2.0
    brightnessShift = -15; // 從 -20 調整到 -15
  } else {
    // 正常場景
    contrastFactor = 1.6; // 從 1.8 降低到 1.6
    brightnessShift = 0;
  }
  
  ocrDebugLog('enhanceContrastForDarkBackground: 對比度增強', {
    avgBrightness: Math.round(avgBrightness),
    stdDev: Math.round(stdDev),
    isLightTextOnDark,
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
function preprocessImage(
  image: HTMLImageElement,
  filterOptions?: {
    enableAdvancedProcessing?: boolean;
    enableAutoThreshold?: boolean;
    invertForLightText?: boolean;
    filters?: Partial<TesseractFiltersConfig>;
  }
): Promise<HTMLImageElement> {
  // 合併 filter 開關配置（允許外部覆蓋）
  const filterSwitches = {
    enableImageSmoothing: filterOptions?.filters?.enableImageSmoothing ?? getConfig().filters.enableImageSmoothing,
    enableImageScale: filterOptions?.filters?.enableImageScale ?? getConfig().filters.enableImageScale,
    enableGrayscale: filterOptions?.filters?.enableGrayscale ?? getConfig().filters.enableGrayscale,
    enableContrastEnhancement: filterOptions?.filters?.enableContrastEnhancement ?? getConfig().filters.enableContrastEnhancement,
    enableInvertForLightText: filterOptions?.filters?.enableInvertForLightText ?? (filterOptions?.invertForLightText ?? getConfig().invertForLightText),
    enableBilateralFilter: filterOptions?.filters?.enableBilateralFilter ?? getConfig().filters.enableBilateralFilter,
    enableRemoveGridLines: filterOptions?.filters?.enableRemoveGridLines ?? getConfig().filters.enableRemoveGridLines,
    enableGaussianBlur: filterOptions?.filters?.enableGaussianBlur ?? getConfig().filters.enableGaussianBlur,
    enableMedianFilter: filterOptions?.filters?.enableMedianFilter ?? getConfig().filters.enableMedianFilter,
    enableSharpen: filterOptions?.filters?.enableSharpen ?? getConfig().filters.enableSharpen,
    enableAutoThreshold: filterOptions?.filters?.enableAutoThreshold ?? (filterOptions?.enableAutoThreshold ?? getConfig().enableAutoThreshold),
    enableBinarization: filterOptions?.filters?.enableBinarization ?? getConfig().filters.enableBinarization,
    enableMorphologyOpen: filterOptions?.filters?.enableMorphologyOpen ?? getConfig().filters.enableMorphologyOpen,
    enableMorphologyClose: filterOptions?.filters?.enableMorphologyClose ?? getConfig().filters.enableMorphologyClose,
  };

  ocrDebugLog('preprocessImage: 開始圖片前處理', {
    inputWidth: image.width,
    inputHeight: image.height,
    imageScale: getConfig().imageScale,
    filterSwitches,
    timestamp: new Date().toISOString(),
  });

  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    // ========== 步驟0: Canvas 設置和圖像縮放 ==========
    const scale = filterSwitches.enableImageScale ? getConfig().imageScale : 1.0;
    const width = Math.floor(image.width * scale);
    const height = Math.floor(image.height * scale);

    ocrDebugLog('preprocessImage: [步驟0] 計算放大後尺寸', {
      originalWidth: image.width,
      originalHeight: image.height,
      scaledWidth: width,
      scaledHeight: height,
      scale,
      enableImageScale: filterSwitches.enableImageScale,
      timestamp: new Date().toISOString(),
    });

    canvas.width = width;
    canvas.height = height;

    // Canvas 圖像平滑設置
    if (filterSwitches.enableImageSmoothing) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ocrDebugLog('preprocessImage: [步驟0] 啟用圖像平滑', {
        timestamp: new Date().toISOString(),
      });
    } else {
      ctx.imageSmoothingEnabled = false;
      ocrDebugLog('preprocessImage: [步驟0] 禁用圖像平滑', {
        timestamp: new Date().toISOString(),
      });
    }
    
    // 確保從 (0,0) 開始繪製，不進行任何偏移
    // 如果不需要縮放，使用原始尺寸繪製；如果需要縮放，使用計算後的尺寸
    if (scale === 1.0) {
      // 不需要縮放時，直接繪製原始圖像，確保像素對齊
      ctx.drawImage(image, 0, 0);
      ocrDebugLog('preprocessImage: [步驟0] 繪製圖像（無縮放）', {
        drawParams: { x: 0, y: 0 },
        imageSize: { width: image.width, height: image.height },
        canvasSize: { width: canvas.width, height: canvas.height },
        timestamp: new Date().toISOString(),
      });
    } else {
      // 需要縮放時，使用計算後的尺寸
      ctx.drawImage(image, 0, 0, width, height);
      ocrDebugLog('preprocessImage: [步驟0] 繪製圖像（縮放）', {
        drawParams: { x: 0, y: 0, width, height },
        imageSize: { width: image.width, height: image.height },
        canvasSize: { width: canvas.width, height: canvas.height },
        scale,
        timestamp: new Date().toISOString(),
      });
    }

    let imageData = ctx.getImageData(0, 0, width, height);
    ocrDebugLog('preprocessImage: 取得 ImageData', {
      dataLength: imageData.data.length,
      width: imageData.width,
      height: imageData.height,
      timestamp: new Date().toISOString(),
    });

    // ========== 步驟1: 灰階化 ==========
    if (filterSwitches.enableGrayscale) {
      ocrDebugLog('preprocessImage: [步驟1] 開始灰階化', {
        pixelCount: imageData.data.length / 4,
        timestamp: new Date().toISOString(),
      });
      const beforeGrayscale = Date.now();
      const data = imageData.data;
      
      // 採樣檢查處理前的顏色分佈（檢查前10個像素）
      const sampleBefore: Array<{ r: number; g: number; b: number; isGray: boolean }> = [];
      for (let i = 0; i < Math.min(40, data.length); i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const isGray = Math.abs(r - g) < 5 && Math.abs(g - b) < 5 && Math.abs(r - b) < 5;
        sampleBefore.push({ r, g, b, isGray });
      }
      
      let processedCount = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = Math.round(
          0.299 * r + 0.587 * g + 0.114 * b
        );
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
        // alpha 通道 (data[i + 3]) 保持不變
        processedCount++;
      }
      
      // 立即將灰階化後的數據寫回 canvas
      ctx.putImageData(imageData, 0, 0);
      
      // 採樣檢查處理後的顏色分佈（從 canvas 重新讀取以驗證）
      const verifyImageData = ctx.getImageData(0, 0, width, height);
      const sampleAfter: Array<{ r: number; g: number; b: number; isGray: boolean }> = [];
      for (let i = 0; i < Math.min(40, verifyImageData.data.length); i += 4) {
        const r = verifyImageData.data[i];
        const g = verifyImageData.data[i + 1];
        const b = verifyImageData.data[i + 2];
        const isGray = Math.abs(r - g) < 5 && Math.abs(g - b) < 5 && Math.abs(r - b) < 5;
        sampleAfter.push({ r, g, b, isGray });
      }
      
      // 統計處理前後顏色變化的像素數量
      let changedPixelCount = 0;
      let alreadyGrayPixelCount = 0;
      for (let i = 0; i < Math.min(100, sampleBefore.length); i++) {
        const before = sampleBefore[i];
        const after = sampleAfter[i];
        const beforeWasGray = before.isGray;
        const afterIsGray = after.isGray;
        const colorChanged = Math.abs(before.r - after.r) > 1 || 
                            Math.abs(before.g - after.g) > 1 || 
                            Math.abs(before.b - after.b) > 1;
        if (colorChanged) {
          changedPixelCount++;
        }
        if (beforeWasGray) {
          alreadyGrayPixelCount++;
        }
      }
      
      // 重新讀取 imageData 以供後續處理使用（確保使用最新的 canvas 數據）
      imageData = ctx.getImageData(0, 0, width, height);
      const afterGrayscale = Date.now();
      ocrDebugLog('preprocessImage: [步驟1] 灰階化完成', {
        duration: afterGrayscale - beforeGrayscale,
        processedPixelCount: processedCount,
        sampleBefore: sampleBefore.slice(0, 5).map(s => `RGB(${s.r},${s.g},${s.b})${s.isGray ? ' [灰]' : ''}`),
        sampleAfter: sampleAfter.slice(0, 5).map(s => `RGB(${s.r},${s.g},${s.b})${s.isGray ? ' [灰]' : ''}`),
        statistics: {
          sampledPixels: Math.min(100, sampleBefore.length),
          changedPixels: changedPixelCount,
          alreadyGrayPixels: alreadyGrayPixelCount,
          changeRatio: `${((changedPixelCount / Math.min(100, sampleBefore.length)) * 100).toFixed(1)}%`,
        },
        note: changedPixelCount === 0 
          ? '⚠️ 所有採樣像素在處理前後顏色相同，圖片可能已經是灰階的'
          : `✅ 灰階化正常工作，${changedPixelCount} 個採樣像素的顏色已轉換`,
        timestamp: new Date().toISOString(),
      });
    } else {
      ocrDebugLog('preprocessImage: [步驟1] 跳過灰階化（已禁用）', {
        timestamp: new Date().toISOString(),
      });
    }

    // ========== 步驟2: 對比度增強 ==========
    if (filterSwitches.enableContrastEnhancement) {
      ocrDebugLog('preprocessImage: [步驟2] 開始自適應對比度增強', {
        timestamp: new Date().toISOString(),
      });
      const beforeContrast = Date.now();
      imageData = enhanceContrastForDarkBackground(imageData);
      const afterContrast = Date.now();
      ocrDebugLog('preprocessImage: [步驟2] 對比度增強完成', {
        duration: afterContrast - beforeContrast,
        timestamp: new Date().toISOString(),
      });
    } else {
      ocrDebugLog('preprocessImage: [步驟2] 跳過對比度增強（已禁用）', {
        timestamp: new Date().toISOString(),
      });
    }

    // ========== 步驟2.5: 檢測並反轉圖像（如果是淺色文字在深色背景上）==========
    if (filterSwitches.enableInvertForLightText) {
      const isLightText = detectLightTextOnDarkBackground(imageData);
      if (isLightText) {
        ocrDebugLog('preprocessImage: [步驟2.5] 檢測到淺色文字，開始反轉圖像', {
          timestamp: new Date().toISOString(),
        });
        const beforeInvert = Date.now();
        imageData = invertImage(imageData);
        const afterInvert = Date.now();
        ocrDebugLog('preprocessImage: [步驟2.5] 圖像反轉完成', {
          duration: afterInvert - beforeInvert,
          timestamp: new Date().toISOString(),
        });
      } else {
        ocrDebugLog('preprocessImage: [步驟2.5] 未檢測到淺色文字，跳過反轉', {
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      ocrDebugLog('preprocessImage: [步驟2.5] 跳過圖像反轉檢查（已禁用）', {
        timestamp: new Date().toISOString(),
      });
    }

    // ========== 步驟3: 進階處理 filters（去噪和背景平滑）==========
    
    // 步驟3.1: 雙邊濾波（保留文字邊緣，平滑背景網格）
    if (filterSwitches.enableBilateralFilter) {
      ocrDebugLog('preprocessImage: [步驟3.1] 開始雙邊濾波去除網格', {
        timestamp: new Date().toISOString(),
      });
      const beforeBilateral = Date.now();
      imageData = applyBilateralFilter(imageData, 2);
      const afterBilateral = Date.now();
      ocrDebugLog('preprocessImage: [步驟3.1] 雙邊濾波完成', {
        duration: afterBilateral - beforeBilateral,
        timestamp: new Date().toISOString(),
      });
    } else {
      ocrDebugLog('preprocessImage: [步驟3.1] 跳過雙邊濾波（已禁用）', {
        timestamp: new Date().toISOString(),
      });
    }

    // 步驟3.2: 去除細小網格線
    if (filterSwitches.enableRemoveGridLines) {
      ocrDebugLog('preprocessImage: [步驟3.2] 開始去除細小網格線', {
        timestamp: new Date().toISOString(),
      });
      const beforeGrid = Date.now();
      imageData = removeGridLines(imageData);
      const afterGrid = Date.now();
      ocrDebugLog('preprocessImage: [步驟3.2] 網格線去除完成', {
        duration: afterGrid - beforeGrid,
        timestamp: new Date().toISOString(),
      });
    } else {
      ocrDebugLog('preprocessImage: [步驟3.2] 跳過去除網格線（已禁用）', {
        timestamp: new Date().toISOString(),
      });
    }

    // 步驟3.3: 高斯模糊平滑背景（使用更大的核）
    if (filterSwitches.enableGaussianBlur) {
      ocrDebugLog('preprocessImage: [步驟3.3] 開始增強高斯模糊平滑背景', {
        timestamp: new Date().toISOString(),
      });
      const beforeBlur = Date.now();
      imageData = applyGaussianBlur(imageData, 2); // 使用更大的核（5x5）
      const afterBlur = Date.now();
      ocrDebugLog('preprocessImage: [步驟3.3] 增強高斯模糊完成', {
        duration: afterBlur - beforeBlur,
        timestamp: new Date().toISOString(),
      });
    } else {
      ocrDebugLog('preprocessImage: [步驟3.3] 跳過高斯模糊（已禁用）', {
        timestamp: new Date().toISOString(),
      });
    }

    // 步驟3.4: 中值濾波去噪（多次應用以更好地去除小噪點）
    if (filterSwitches.enableMedianFilter) {
      ocrDebugLog('preprocessImage: [步驟3.4] 開始中值濾波去噪', {
        timestamp: new Date().toISOString(),
      });
      const beforeFilter = Date.now();
      imageData = applyMedianFilter(imageData, 2); // 使用更大的半徑
      // 再次應用以更好地去除殘留噪點
      imageData = applyMedianFilter(imageData, 1);
      const afterFilter = Date.now();
      ocrDebugLog('preprocessImage: [步驟3.4] 中值濾波完成', {
        duration: afterFilter - beforeFilter,
        timestamp: new Date().toISOString(),
      });
    } else {
      ocrDebugLog('preprocessImage: [步驟3.4] 跳過中值濾波（已禁用）', {
        timestamp: new Date().toISOString(),
      });
    }

    // ========== 步驟4: 銳化處理（增強文字邊緣，針對繁體字筆畫多使用強銳化）==========
    if (filterSwitches.enableSharpen) {
      ocrDebugLog('preprocessImage: [步驟4] 開始銳化處理', {
        sharpenStrength: getConfig().sharpenStrength,
        timestamp: new Date().toISOString(),
      });
      const beforeSharpen = Date.now();
      imageData = applySharpen(imageData, getConfig().sharpenStrength as 'normal' | 'strong');
      const afterSharpen = Date.now();
      ocrDebugLog('preprocessImage: [步驟4] 銳化完成', {
        duration: afterSharpen - beforeSharpen,
        timestamp: new Date().toISOString(),
      });
    } else {
      ocrDebugLog('preprocessImage: [步驟4] 跳過銳化處理（已禁用）', {
        timestamp: new Date().toISOString(),
      });
    }

    // ========== 步驟5: 計算自動閾值 ==========
    let threshold = getConfig().threshold;
    if (filterSwitches.enableAutoThreshold) {
      ocrDebugLog('preprocessImage: [步驟5] 開始計算 Otsu 閾值', {
        timestamp: new Date().toISOString(),
      });
      const beforeThreshold = Date.now();
      threshold = calculateOtsuThreshold(imageData);
      const afterThreshold = Date.now();
      ocrDebugLog('preprocessImage: [步驟5] Otsu 閾值計算完成', {
        threshold,
        duration: afterThreshold - beforeThreshold,
        timestamp: new Date().toISOString(),
      });
    } else {
      ocrDebugLog('preprocessImage: [步驟5] 使用固定閾值', {
        threshold,
        timestamp: new Date().toISOString(),
      });
    }

    // ========== 步驟6: 二值化 ==========
    if (filterSwitches.enableBinarization) {
      ocrDebugLog('preprocessImage: [步驟6] 開始二值化', {
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
      ocrDebugLog('preprocessImage: [步驟6] 二值化完成', {
        duration: afterBinarization - beforeBinarization,
        timestamp: new Date().toISOString(),
      });
    } else {
      ocrDebugLog('preprocessImage: [步驟6] 跳過二值化（已禁用）', {
        timestamp: new Date().toISOString(),
      });
    }

    // ========== 步驟7: 形態學開運算（去除小噪點）==========
    if (filterSwitches.enableMorphologyOpen) {
      ocrDebugLog('preprocessImage: [步驟7] 開始形態學開運算', {
        timestamp: new Date().toISOString(),
      });
      const beforeMorphology = Date.now();
      imageData = applyMorphologyOpen(imageData, 2); // 使用更大的核
      const afterMorphology = Date.now();
      ocrDebugLog('preprocessImage: [步驟7] 形態學開運算完成', {
        duration: afterMorphology - beforeMorphology,
        timestamp: new Date().toISOString(),
      });
    } else {
      ocrDebugLog('preprocessImage: [步驟7] 跳過形態學開運算（已禁用）', {
        timestamp: new Date().toISOString(),
      });
    }

    // ========== 步驟7.5: 形態學閉運算（連接斷裂的筆畫，針對繁體字筆畫多的特點）==========
    if (filterSwitches.enableMorphologyClose) {
      ocrDebugLog('preprocessImage: [步驟7.5] 開始形態學閉運算（連接斷裂筆畫）', {
        kernelSize: getConfig().morphologyCloseKernelSize,
        timestamp: new Date().toISOString(),
      });
      const beforeClose = Date.now();
      imageData = applyMorphologyClose(imageData, getConfig().morphologyCloseKernelSize);
      const afterClose = Date.now();
      ocrDebugLog('preprocessImage: [步驟7.5] 形態學閉運算完成', {
        duration: afterClose - beforeClose,
        timestamp: new Date().toISOString(),
      });
    } else {
      ocrDebugLog('preprocessImage: [步驟7.5] 跳過形態學閉運算（已禁用）', {
        timestamp: new Date().toISOString(),
      });
    }

    ctx.putImageData(imageData, 0, 0);

    // 記錄 canvas 處理前後的圖像信息，用於調試
    ocrDebugLog('preprocessImage: Canvas 處理完成，準備轉換為 Image', {
      canvasSize: { width: canvas.width, height: canvas.height },
      imageDataSize: { width: imageData.width, height: imageData.height },
      originalImageSize: { width: image.width, height: image.height },
      hasAnyFilterApplied: Object.values(filterSwitches).some(v => v === true),
      scale: filterSwitches.enableImageScale ? getConfig().imageScale : 1.0,
      // 檢查圖像尺寸是否一致，確保沒有偏移
      sizeMatches: canvas.width === imageData.width && canvas.height === imageData.height && 
                   (filterSwitches.enableImageScale ? 
                     (canvas.width === Math.floor(image.width * getConfig().imageScale) && 
                      canvas.height === Math.floor(image.height * getConfig().imageScale)) :
                     (canvas.width === image.width && canvas.height === image.height)),
      timestamp: new Date().toISOString(),
    });

    const processedImg = new Image();
    processedImg.onload = () => {
      ocrDebugLog('preprocessImage: 前處理完成', {
        originalImageSize: { width: image.width, height: image.height },
        finalWidth: processedImg.width,
        finalHeight: processedImg.height,
        canvasSize: { width: canvas.width, height: canvas.height },
        timestamp: new Date().toISOString(),
      });
      resolve(processedImg);
    };
    processedImg.src = canvas.toDataURL('image/png');
  });
}

/**
 * 從 itemtw 數據中構建字符白名單（增強版：包含 bigram/trigram）
 * 提取所有物品名稱中出現的唯一字符、bigram 和 trigram
 * @returns {Promise<string>} 字符白名單字符串（用於 Tesseract）
 */
async function buildItemtwCharWhitelist(): Promise<string> {
  // 如果已經構建過，直接返回緩存
  if (itemtwCharWhitelist !== null) {
    return itemtwCharWhitelist;
  }

  // 如果正在構建中，等待構建完成
  if (whitelistBuildPromise !== null) {
    return whitelistBuildPromise;
  }

  // 開始構建白名單
  whitelistBuildPromise = (async () => {
    ocrDebugLog('buildItemtwCharWhitelist: 開始構建 itemtw 字符白名單（增強版）', {
      timestamp: new Date().toISOString(),
    });

    const buildStartTime = Date.now();
    
    try {
      // 從 supabaseData 獲取 itemtw 數據（使用已緩存的數據）
      const twItemsData = await getTwItems();
      
      // 提取所有唯一字符、bigram 和 trigram
      const charSet = new Set<string>();
      const bigramSet = new Set<string>();
      const trigramSet = new Set<string>();
      
      Object.values(twItemsData).forEach((item: any) => {
        if (item && item.tw && typeof item.tw === 'string') {
          const name = item.tw.trim();
          if (!name) return;
          
          // 提取字符
          for (const char of name) {
            // 只保留繁體中文字符（Unicode 範圍：\u3400-\u4DBF 和 \u4E00-\u9FFF）
            const codePoint = char.codePointAt(0);
            if (codePoint !== undefined) {
              if (
                (codePoint >= 0x3400 && codePoint <= 0x4DBF) || // 擴展A
                (codePoint >= 0x4E00 && codePoint <= 0x9FFF)    // 基本漢字
              ) {
                charSet.add(char);
              }
            }
          }
          
          // 提取 bigram（兩個字符的組合）
          for (let i = 0; i < name.length - 1; i++) {
            const char1 = name[i];
            const char2 = name[i + 1];
            const codePoint1 = char1.codePointAt(0);
            const codePoint2 = char2.codePointAt(0);
            if (codePoint1 !== undefined && codePoint2 !== undefined) {
              if (
                ((codePoint1 >= 0x3400 && codePoint1 <= 0x4DBF) || (codePoint1 >= 0x4E00 && codePoint1 <= 0x9FFF)) &&
                ((codePoint2 >= 0x3400 && codePoint2 <= 0x4DBF) || (codePoint2 >= 0x4E00 && codePoint2 <= 0x9FFF))
              ) {
                bigramSet.add(char1 + char2);
              }
            }
          }
          
          // 提取 trigram（三個字符的組合）
          for (let i = 0; i < name.length - 2; i++) {
            const char1 = name[i];
            const char2 = name[i + 1];
            const char3 = name[i + 2];
            const codePoint1 = char1.codePointAt(0);
            const codePoint2 = char2.codePointAt(0);
            const codePoint3 = char3.codePointAt(0);
            if (codePoint1 !== undefined && codePoint2 !== undefined && codePoint3 !== undefined) {
              if (
                ((codePoint1 >= 0x3400 && codePoint1 <= 0x4DBF) || (codePoint1 >= 0x4E00 && codePoint1 <= 0x9FFF)) &&
                ((codePoint2 >= 0x3400 && codePoint2 <= 0x4DBF) || (codePoint2 >= 0x4E00 && codePoint2 <= 0x9FFF)) &&
                ((codePoint3 >= 0x3400 && codePoint3 <= 0x4DBF) || (codePoint3 >= 0x4E00 && codePoint3 <= 0x9FFF))
              ) {
                trigramSet.add(char1 + char2 + char3);
              }
            }
          }
        }
      });

      // 將字符集合轉換為排序後的字符串（排序有助於 Tesseract 優化）
      const sortedChars = Array.from(charSet).sort();
      itemtwCharWhitelist = sortedChars.join('');
      
      // 緩存完整的白名單數據（用於後續驗證）
      itemtwWhitelistCache = {
        charSet,
        bigramSet,
        trigramSet,
      };

      const buildDuration = Date.now() - buildStartTime;
      ocrDebugLog('buildItemtwCharWhitelist: 白名單構建完成（增強版）', {
        uniqueCharCount: charSet.size,
        uniqueBigramCount: bigramSet.size,
        uniqueTrigramCount: trigramSet.size,
        whitelistLength: itemtwCharWhitelist.length,
        duration: buildDuration,
        timestamp: new Date().toISOString(),
      });

      return itemtwCharWhitelist;
    } catch (error) {
      ocrDebugLog('buildItemtwCharWhitelist: 構建白名單失敗', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
      
      // 構建失敗時返回空字符串（不使用白名單限制）
      whitelistBuildPromise = null;
      return '';
    }
  })();

  return whitelistBuildPromise;
}

/**
 * 驗證 OCR 識別結果是否符合白名單（使用 bigram/trigram 增強驗證）
 * @param text OCR 識別的文字
 * @returns 是否符合白名單要求
 */
function validateAgainstWhitelist(text: string): boolean {
  if (!getConfig().useItemtwWhitelist || !itemtwWhitelistCache) {
    return true; // 如果未啟用白名單或緩存未構建，不進行驗證
  }
  
  const { charSet, bigramSet, trigramSet } = itemtwWhitelistCache;
  
  // 檢查所有字符是否在白名單中
  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (codePoint !== undefined) {
      if (
        (codePoint >= 0x3400 && codePoint <= 0x4DBF) || 
        (codePoint >= 0x4E00 && codePoint <= 0x9FFF)
      ) {
        if (!charSet.has(char)) {
          return false; // 發現不在白名單中的字符
        }
      }
    }
  }
  
  // 可選：檢查 bigram/trigram 匹配度（用於評分，但不強制要求）
  // 這裡只做字符級別驗證，bigram/trigram 用於搜索階段的相似度計算
  
  return true;
}

/**
 * 檢測圖片中的文字區域（使用快速OCR）
 * 返回文字區域的邊界框
 * @param image 圖片元素
 * @returns 文字區域邊界框 {x, y, width, height}，如果檢測失敗返回 null
 */
async function detectTextRegion(image: HTMLImageElement): Promise<{ x: number; y: number; width: number; height: number } | null> {
  ocrDebugLog('detectTextRegion: 開始檢測文字區域', {
    imageWidth: image.width,
    imageHeight: image.height,
    timestamp: new Date().toISOString(),
  });

  try {
    if (typeof window.Tesseract === 'undefined') {
      console.warn('[OCR DEBUG] detectTextRegion: Tesseract.js 未載入，跳過自動檢測', {
        timestamp: new Date().toISOString(),
      });
      return null;
    }

    // 創建臨時 Worker 進行快速檢測
    // 使用 Tesseract 原生 CDN 模型；傳入 LSTM 專用 init config 避免載入含舊版參數的預設 config（消除「Parameter not found」警告）
    const worker = await window.Tesseract.createWorker(getConfig().tesseractLang, 1, {}, TESSERACT_INIT_CONFIG);
    
    // 構建參數：使用快速模式（OEM 已在 createWorker(lang, 1) 時設為 LSTM，勿在此重設）
    const detectionParams: Record<string, string> = {
      tessedit_pageseg_mode: '7', // 單行文本模式
    };
    
    // 如果白名單已構建，使用它來提高檢測準確度
    if (getConfig().useItemtwWhitelist && itemtwCharWhitelist !== null) {
      detectionParams.tessedit_char_whitelist = itemtwCharWhitelist;
      ocrDebugLog('detectTextRegion: 使用 itemtw 白名單進行檢測', {
        whitelistLength: itemtwCharWhitelist.length,
        timestamp: new Date().toISOString(),
      });
    }
    
    await worker.setParameters(detectionParams);

    // 執行快速識別以獲取文字位置
    const result = await worker.recognize(image);
    await worker.terminate();

    // 從 words 數據中計算文字區域邊界
    if (!result.data.words || result.data.words.length === 0) {
      console.warn('[OCR DEBUG] detectTextRegion: 未檢測到文字', {
        timestamp: new Date().toISOString(),
      });
      return null;
    }

    // 收集所有有效的文字邊界框
    const validWords = result.data.words.filter((word) => 
      word.bbox && word.text.trim().length > 0
    );
    
    if (validWords.length === 0) {
      console.warn('[OCR DEBUG] detectTextRegion: 沒有有效的文字', {
        timestamp: new Date().toISOString(),
      });
      return null;
    }

    // 計算所有文字的最小邊界框（X和Y的起始位置）
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    
    // 收集所有文字的下邊界（y1）和上邊界（y0）
    const bottomEdges: number[] = [];
    const topEdges: number[] = [];
    
    validWords.forEach((word) => {
      if (word.bbox) {
        minX = Math.min(minX, word.bbox.x0);
        minY = Math.min(minY, word.bbox.y0);
        maxX = Math.max(maxX, word.bbox.x1);
        bottomEdges.push(word.bbox.y1);
        topEdges.push(word.bbox.y0);
      }
    });
    
    // 對下邊界進行排序，使用更保守的方法來確定實際文字下邊界
    // 使用第90百分位數而不是最大值，避免包含離群的底部空白
    bottomEdges.sort((a, b) => a - b);
    topEdges.sort((a, b) => a - b);
    
    // 計算文字行的平均高度，用於判斷離群值
    const heights = validWords
      .map((word) => word.bbox ? word.bbox.y1 - word.bbox.y0 : 0)
      .filter((h) => h > 0);
    const avgHeight = heights.reduce((sum, h) => sum + h, 0) / heights.length;
    
    // 使用更保守的百分位數來確定實際文字下邊界，減少底部空白
    // 優先使用第80百分位數，如果與最大值差距大則進一步收緊
    const maxBottomEdge = Math.max(...bottomEdges);
    const percentile80Index = Math.floor(bottomEdges.length * 0.8);
    let maxY = bottomEdges[percentile80Index];
    
    // 如果第80百分位數和最大值差距太大（超過平均高度的1.5倍），進一步收緊
    if (maxBottomEdge - maxY > avgHeight * 1.5) {
      // 使用第75百分位數，更保守
      const percentile75Index = Math.floor(bottomEdges.length * 0.75);
      maxY = bottomEdges[percentile75Index];
      
      // 如果差距仍然很大，使用第70百分位數
      if (maxBottomEdge - maxY > avgHeight * 2) {
        const percentile70Index = Math.floor(bottomEdges.length * 0.7);
        maxY = bottomEdges[percentile70Index];
      }
    }
    
    // 確保maxY至少包含大部分文字（至少第65百分位數）
    const percentile65Index = Math.floor(bottomEdges.length * 0.65);
    maxY = Math.max(maxY, bottomEdges[percentile65Index]);

    // 如果沒有有效的邊界框，返回 null
    if (minX === Infinity || minY === Infinity || maxX === -Infinity || maxY === -Infinity) {
      console.warn('[OCR DEBUG] detectTextRegion: 邊界框無效', {
        timestamp: new Date().toISOString(),
      });
      return null;
    }

    // 計算文字區域的實際尺寸
    const textWidth = maxX - minX;
    const textHeight = maxY - minY;
    
    // 根據圖片尺寸和文字區域大小動態調整邊距
    // 對於較小的圖片或較小的文字區域，使用更小的邊距以更貼近文字
    const basePadding = getConfig().autoCropPadding;
    const imageArea = image.width * image.height;
    const textArea = textWidth * textHeight;
    const textRatio = textArea / imageArea;
    
    // 動態調整：小圖片或文字佔比大時使用更小邊距，大圖片時稍微增加邊距
    let padding = basePadding;
    if (imageArea < 500000) { // 小圖片（約707x707以下）
      padding = Math.max(2, basePadding * 0.6);
    } else if (imageArea > 2000000) { // 大圖片（約1414x1414以上）
      padding = Math.min(8, basePadding * 1.2);
    } else if (textRatio > 0.3) { // 文字區域佔比大
      padding = Math.max(2, basePadding * 0.7);
    }
    
    // 確保邊距不會太小（至少2像素）也不會太大（最多8像素）
    padding = Math.max(2, Math.min(8, padding));
    
    const x = Math.max(0, Math.floor(minX - padding));
    const y = Math.max(0, Math.floor(minY - padding));
    const width = Math.min(image.width - x, Math.floor(maxX - minX + padding * 2));
    const height = Math.min(image.height - y, Math.floor(maxY - minY + padding * 2));

    // 確保區域有效
    if (width <= 0 || height <= 0) {
      console.warn('[OCR DEBUG] detectTextRegion: 計算出的區域無效', {
        x, y, width, height,
        timestamp: new Date().toISOString(),
      });
      return null;
    }

    // 計算優化後節省的高度（相對於使用最大邊界）
    const savedHeight = maxBottomEdge - maxY;
    
    ocrDebugLog('detectTextRegion: 文字區域檢測完成', {
      detectedRegion: { x, y, width, height },
      originalSize: { width: image.width, height: image.height },
      textRegion: { x: minX, y: minY, width: textWidth, height: textHeight },
      boundaryOptimization: {
        maxBottomEdge: maxBottomEdge.toFixed(1),
        usedMaxY: maxY.toFixed(1),
        savedHeight: savedHeight.toFixed(1),
        avgHeight: avgHeight.toFixed(1),
        wordCount: validWords.length,
      },
      padding: padding.toFixed(1),
      reductionRatio: ((1 - (width * height) / (image.width * image.height)) * 100).toFixed(1) + '%',
      timestamp: new Date().toISOString(),
    });

    return { x, y, width, height };
  } catch (error) {
    ocrDebugLog('detectTextRegion: 檢測失敗', {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
    return null;
  }
}

/**
 * 根據檢測到的文字區域自動裁剪圖片
 * @param image 原始圖片
 * @param region 文字區域 {x, y, width, height}
 * @returns 裁剪後的圖片元素
 */
function autoCropImage(image: HTMLImageElement, region: { x: number; y: number; width: number; height: number }): Promise<HTMLImageElement> {
  ocrDebugLog('autoCropImage: 開始自動裁剪', {
    originalSize: { width: image.width, height: image.height },
    cropRegion: region,
    timestamp: new Date().toISOString(),
  });

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    canvas.width = region.width;
    canvas.height = region.height;

    // 使用 filter 開關控制圖像平滑
    if (getConfig().filters.enableImageSmoothing) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    } else {
      ctx.imageSmoothingEnabled = false;
    }
    
    // 裁剪圖片
    ctx.drawImage(
      image,
      region.x, region.y, region.width, region.height, // 源區域
      0, 0, region.width, region.height // 目標區域
    );

    const croppedImg = new Image();
    croppedImg.onload = () => {
      ocrDebugLog('autoCropImage: 裁剪完成', {
        croppedSize: { width: croppedImg.width, height: croppedImg.height },
        timestamp: new Date().toISOString(),
      });
      resolve(croppedImg);
    };
    croppedImg.onerror = (error) => {
      ocrDebugLog('autoCropImage: 裁剪失敗', {
        error,
        timestamp: new Date().toISOString(),
      });
      reject(new Error('自動裁剪失敗'));
    };
    croppedImg.src = canvas.toDataURL('image/png');
  });
}

/**
 * ========== 統一的文字區域檢測和裁剪函數 ==========
 * 所有檢測和裁剪邏輯都集中在這裡，受到 enableAutoTextDetection 控制
 * @param image 要處理的圖片
 * @param enableAutoTextDetection 是否啟用自動檢測和裁剪
 * @param onProgress 進度回調（可選）
 * @returns 處理後的圖片（如果啟用且檢測成功則返回裁剪後的圖片，否則返回原圖）和檢測到的區域（如果有的話）
 */
async function detectAndCropTextRegion(
  image: HTMLImageElement,
  enableAutoTextDetection: boolean,
  onProgress?: (progress: number) => void
): Promise<{ image: HTMLImageElement; region: { x: number; y: number; width: number; height: number } | null }> {
  ocrDebugLog('detectAndCropTextRegion: 開始處理', {
    enableAutoTextDetection,
    imageSize: { width: image.width, height: image.height },
    timestamp: new Date().toISOString(),
  });

  // 如果未啟用自動檢測，直接返回原圖
  if (!enableAutoTextDetection) {
    ocrDebugLog('detectAndCropTextRegion: 自動檢測已禁用，返回原圖', {
      timestamp: new Date().toISOString(),
    });
    return { image, region: null };
  }

  // 執行檢測和裁剪（必要時：白區過多則先去角落黑邊再重做一次偵測+裁切）
  const TEXT_AREA_RATIO_THRESHOLD = 0.25; // 文字區域佔比低於此視為「白區過多」
  try {
    const detectionStartTime = Date.now();
    let textRegion = await detectTextRegion(image);
    const detectionDuration = Date.now() - detectionStartTime;

    if (textRegion) {
      ocrDebugLog('detectAndCropTextRegion: 檢測到文字區域，開始自動裁剪', {
        region: textRegion,
        detectionDuration,
        timestamp: new Date().toISOString(),
      });

      try {
        const cropStartTime = Date.now();
        let croppedImage = await autoCropImage(image, textRegion);
        const cropDuration = Date.now() - cropStartTime;

        const imageArea = image.width * image.height;
        const textArea = textRegion.width * textRegion.height;
        const textAreaRatio = imageArea > 0 ? textArea / imageArea : 0;
        const whiteAreaTooMuch = textAreaRatio < TEXT_AREA_RATIO_THRESHOLD;

        if (whiteAreaTooMuch) {
          ocrDebugLog('detectAndCropTextRegion: 白區過多，先去角落黑邊再重做文字偵測與裁切', {
            textAreaRatio: textAreaRatio.toFixed(2),
            threshold: TEXT_AREA_RATIO_THRESHOLD,
            timestamp: new Date().toISOString(),
          });
          try {
            const trimmedImage = await cropBlackBorders(image);
            if (trimmedImage !== image) {
              const textRegion2 = await detectTextRegion(trimmedImage);
              if (textRegion2) {
                const croppedImage2 = await autoCropImage(trimmedImage, textRegion2);
                croppedImage = croppedImage2;
                textRegion = textRegion2;
                ocrDebugLog('detectAndCropTextRegion: 去黑邊後再次裁切完成', {
                  trimmedSize: { width: trimmedImage.width, height: trimmedImage.height },
                  finalCroppedSize: { width: croppedImage.width, height: croppedImage.height },
                  timestamp: new Date().toISOString(),
                });
              }
            }
          } catch (retryError) {
            console.warn('[OCR DEBUG] detectAndCropTextRegion: 去黑邊重試失敗，使用第一次裁切結果', {
              error: retryError,
              timestamp: new Date().toISOString(),
            });
          }
        }

        ocrDebugLog('detectAndCropTextRegion: 自動裁剪完成', {
          originalSize: { width: image.width, height: image.height },
          croppedSize: { width: croppedImage.width, height: croppedImage.height },
          cropDuration,
          timestamp: new Date().toISOString(),
        });

        // 更新進度（如果提供了回調）
        if (onProgress) {
          onProgress(0.2); // 檢測和裁剪完成，約20%進度
        }

        return { image: croppedImage, region: textRegion };
      } catch (error) {
        console.warn('[OCR DEBUG] detectAndCropTextRegion: 自動裁剪失敗，使用原圖', {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
        // 裁剪失敗時使用原圖
        return { image, region: null };
      }
    } else {
      // 第一次未檢測到文字時，也嘗試先去黑邊再偵測一次
      ocrDebugLog('detectAndCropTextRegion: 未檢測到文字區域，嘗試去角落黑邊後再偵測一次', {
        detectionDuration,
        timestamp: new Date().toISOString(),
      });
      try {
        const trimmedImage = await cropBlackBorders(image);
        if (trimmedImage !== image) {
          const textRegion2 = await detectTextRegion(trimmedImage);
          if (textRegion2) {
            const croppedImage2 = await autoCropImage(trimmedImage, textRegion2);
            if (onProgress) onProgress(0.2);
            return { image: croppedImage2, region: textRegion2 };
          }
        }
      } catch (retryError) {
        console.warn('[OCR DEBUG] detectAndCropTextRegion: 去黑邊重試失敗', {
          error: retryError,
          timestamp: new Date().toISOString(),
        });
      }
      return { image, region: null };
    }
  } catch (error) {
    ocrDebugLog('detectAndCropTextRegion: 處理過程發生錯誤，使用原圖', {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
    return { image, region: null };
  }
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
 * 將 HTMLImageElement 轉換為 data URL
 * 確保圖片已完全載入，並驗證尺寸
 */
function imageToDataURL(image: HTMLImageElement): string {
  // 確保圖片已完全載入
  if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
    console.warn('[OCR DEBUG] imageToDataURL: 圖片未完全載入', {
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      width: image.width,
      height: image.height,
      timestamp: new Date().toISOString(),
    });
  }

  // 使用 naturalWidth/naturalHeight 確保使用實際圖片尺寸
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  if (width <= 0 || height <= 0) {
    ocrDebugLog('imageToDataURL: 圖片尺寸無效', {
      width,
      height,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      imageWidth: image.width,
      imageHeight: image.height,
      imageSrc: image.src.substring(0, 100),
      timestamp: new Date().toISOString(),
    });
    throw new Error('圖片尺寸無效，無法轉換為 data URL');
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = width;
  canvas.height = height;
  
  // 使用 filter 開關控制圖像平滑
  if (getConfig().enableDebugImageSmoothing) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  } else {
    ctx.imageSmoothingEnabled = false;
  }
  
  ctx.drawImage(image, 0, 0, width, height);
  
  const dataURL = canvas.toDataURL('image/png');
  
  ocrDebugLog('imageToDataURL: 轉換完成', {
    originalSize: { width: image.width, height: image.height },
    naturalSize: { width: image.naturalWidth, height: image.naturalHeight },
    canvasSize: { width, height },
    dataURLLength: dataURL.length,
    imageSrc: image.src.substring(0, 100),
    timestamp: new Date().toISOString(),
  });
  
  return dataURL;
}

/**
 * 使用 Tesseract.js 執行 OCR
 * 如果啟用自動檢測，會先檢測文字區域並裁剪，然後再進行識別
 */
async function performOCR(
  image: HTMLImageElement,
  filterOptions?: {
    enableAutoTextDetection?: boolean;
    useItemtwWhitelist?: boolean;
    excludeSymbolsAndNumbers?: boolean;
  },
  onProgress?: (p: number) => void,
  debugConfirmCallback?: (imageDataUrl: string) => Promise<boolean>
): Promise<{ text: string; ocrWords?: Array<{ text: string; confidence: number }>; ocrConfidence?: number }> {
  const startTime = Date.now();
  const effectiveOptions = {
    enableAutoTextDetection: filterOptions?.enableAutoTextDetection ?? getConfig().filters.enableAutoTextDetection,
    useItemtwWhitelist: filterOptions?.useItemtwWhitelist ?? getConfig().useItemtwWhitelist,
    excludeSymbolsAndNumbers: filterOptions?.excludeSymbolsAndNumbers ?? getConfig().excludeSymbolsAndNumbersAtRecognition,
  };

  ocrDebugLog('performOCR: 開始 OCR 識別', {
    imageWidth: image.width,
    imageHeight: image.height,
    imageSrc: image.src.substring(0, 50) + '...',
    hasProgressCallback: !!onProgress,
    enableAutoTextDetection: effectiveOptions.enableAutoTextDetection,
    useItemtwWhitelist: effectiveOptions.useItemtwWhitelist,
    excludeSymbolsAndNumbers: effectiveOptions.excludeSymbolsAndNumbers,
    timestamp: new Date().toISOString(),
  });

  // ========== 統一的文字區域檢測和裁剪邏輯 ==========
  // 使用統一的函數處理，確保所有檢測和裁剪邏輯都受到 enableAutoTextDetection 控制
  ocrDebugLog('performOCR: 開始統一的檢測和裁剪處理', {
    enableAutoTextDetection: effectiveOptions.enableAutoTextDetection,
    inputImageSize: { width: image.width, height: image.height },
    timestamp: new Date().toISOString(),
  });
  
  const { image: finalImage, region: detectedRegion } = await detectAndCropTextRegion(
    image,
    effectiveOptions.enableAutoTextDetection,
    onProgress
  );
  
  ocrDebugLog('performOCR: 檢測和裁剪處理完成', {
    finalImageSize: { width: finalImage.width, height: finalImage.height },
    isSameAsInput: finalImage === image,
    hasDetectedRegion: detectedRegion !== null,
    detectedRegion,
    timestamp: new Date().toISOString(),
  });

  try {
    // 檢查 Tesseract 是否已載入
    ocrDebugLog('performOCR: 檢查 Tesseract.js 是否載入', {
      isDefined: typeof window.Tesseract !== 'undefined',
      tesseractType: typeof window.Tesseract,
      timestamp: new Date().toISOString(),
    });

    if (typeof window.Tesseract === 'undefined') {
      ocrDebugLog('performOCR: Tesseract.js 未載入', {
        timestamp: new Date().toISOString(),
      });
      throw new Error('Tesseract.js 尚未載入，請稍候再試');
    }

    // Tesseract.js v5: 語言需要在 createWorker 時直接指定
    // loadLanguage 和 initialize 已被棄用，不再需要調用
    // 使用 Tesseract 原生 CDN 模型
    ocrDebugLog('performOCR: 開始創建 Worker（指定語言）', {
      language: getConfig().tesseractLang,
      modelSource: 'CDN (Tesseract 原生繁體中文模型)',
      timestamp: new Date().toISOString(),
    });
    const workerCreateStart = Date.now();
    // v5 API: createWorker(lang, oem?, options?, config?) - 使用 CDN 原生模型；傳入 LSTM 專用 init config 避免「Parameter not found」警告
    const worker = await window.Tesseract.createWorker(getConfig().tesseractLang, 1, {}, TESSERACT_INIT_CONFIG);
    const workerCreateEnd = Date.now();
    ocrDebugLog('performOCR: Worker 創建成功（已預載語言）', {
      duration: workerCreateEnd - workerCreateStart,
      language: getConfig().tesseractLang,
      modelSource: 'CDN (Tesseract 原生繁體中文模型)',
      workerType: typeof worker,
      timestamp: new Date().toISOString(),
    });

    // 設定 OCR 參數以提升繁體中文識別度
    // 只檢索繁體中文：在識別階段就嚴格限制字符範圍
    let chineseCharWhitelist = '';
    
    if (effectiveOptions.useItemtwWhitelist) {
      // 方案1：使用 itemtw 白名單，只識別 itemtw 中存在的繁體中文字符
      // 首次使用時會構建並緩存白名單（白名單已確保只包含繁體中文 Unicode 範圍）
      ocrDebugLog('performOCR: 開始構建/獲取 itemtw 字符白名單', {
        timestamp: new Date().toISOString(),
      });
      const whitelistStartTime = Date.now();
      chineseCharWhitelist = await buildItemtwCharWhitelist();
      const whitelistDuration = Date.now() - whitelistStartTime;
      
      ocrDebugLog('performOCR: itemtw 字符白名單準備完成', {
        whitelistLength: chineseCharWhitelist.length,
        uniqueCharCount: chineseCharWhitelist.length > 0 ? new Set(chineseCharWhitelist).size : 0,
        duration: whitelistDuration,
        timestamp: new Date().toISOString(),
      });
    } else {
      // 方案2：不使用 itemtw 白名單，但只識別繁體中文
      // 注意：由於繁體中文字符數量龐大（數萬個），無法在 Tesseract whitelist 中完整列出
      // 因此採用以下策略：
      // 1. 不設置 whitelist（讓 Tesseract 使用 chi_tra 模型識別所有字符）
      // 2. 通過 classify_bln_numeric_mode='0' 禁用數字模式，減少數字誤識別
      // 3. 在後處理階段通過 filterChineseOnly 嚴格過濾，只保留繁體中文 Unicode 範圍
      chineseCharWhitelist = '';
      
      ocrDebugLog('performOCR: 使用識別後過濾模式（只檢索繁體中文）', {
        note: '識別階段不限制字符，後處理階段將嚴格過濾為繁體中文',
        timestamp: new Date().toISOString(),
      });
    }
    
    // OEM 已在 createWorker(lang, 1) 時設為 LSTM，勿用 setParameters 重設 tessedit_ocr_engine_mode（會觸發「只能於初始化時設定」警告）
    const params = {
      tessedit_char_whitelist: chineseCharWhitelist, // 字符白名單：空字符串 = 不限制字符；非空 = 只識別白名單中的字符（使用 itemtw 白名單時，只識別 itemtw 中存在的字符）
      tessedit_pageseg_mode: '7', // 單行文本模式，確保字符按正確順序識別
      classify_bln_numeric_mode: '0', // 不限制為數字模式（0=禁用數字模式，有助於減少數字誤識別）
      textord_min_linesize: '2.5', // 最小行尺寸
      classify_enable_learning: '0', // 禁用學習模式以保持一致性
      // 針對深色背景+淺色文字的優化參數
      tessedit_char_blacklist: '', // 不排除任何字符
      textord_tabvector_vertical_gap_factor: '0.5', // 減少垂直間隙因子，有助於識別緊密排列的文字
      textord_min_blob_size_fraction: '0.08', // 進一步降低最小blob尺寸分數（從0.1降到0.08），識別更細小的筆畫
      textord_excess_blob_size: '1.5', // 增加blob尺寸容忍度（從1.3提升到1.5），適應繁體字筆畫多的特點
      // 提升文字識別敏感度（針對繁體字筆畫多優化）
      textord_really_old_xheight: '0.85', // 進一步降低x高度閾值（從0.9降到0.85），識別更小的文字和細筆畫
      classify_adapt_proto_threshold: '0.4', // 進一步降低原型適應閾值（從0.5降到0.4），提高對複雜字符的識別敏感度
      classify_adapt_feature_threshold: '0.4', // 進一步降低特徵適應閾值（從0.5降到0.4），提高對細小筆畫的識別
      // 針對單行文本的優化
      textord_min_linesize_fraction: '0.08', // 進一步降低最小行尺寸分數（從0.1降到0.08），適應繁體字筆畫密集的特點
      textord_debug_pitch_metric: '0', // 禁用調試模式
      // 針對繁體字筆畫多的額外優化參數
      textord_min_blob_size: '2', // 最小blob尺寸（像素），降低以識別更細的筆畫
      classify_misfit_junk_penalty: '0.1', // 降低誤識別懲罰，提高對複雜字符的容忍度
      classify_accept_rating: '0.2', // 降低接受評級閾值，提高識別敏感度
    };
    ocrDebugLog('performOCR: 設定 OCR 參數', {
      params,
      timestamp: new Date().toISOString(),
    });
    await worker.setParameters(params);
    ocrDebugLog('performOCR: OCR 參數設定完成', {
      timestamp: new Date().toISOString(),
    });

    // Debug 模式：在輸入到 tesseract 前顯示確認框
    if (getConfig().debugMode && debugConfirmCallback) {
      // 確保 finalImage 已完全載入
      if (!finalImage.complete || finalImage.naturalWidth === 0 || finalImage.naturalHeight === 0) {
        // 等待圖片載入完成
        await new Promise((resolve, reject) => {
          if (finalImage.complete && finalImage.naturalWidth > 0 && finalImage.naturalHeight > 0) {
            resolve(null);
          } else {
            finalImage.onload = () => resolve(null);
            finalImage.onerror = () => reject(new Error('圖片載入失敗'));
            setTimeout(() => reject(new Error('圖片載入超時')), 5000);
          }
        });
      }
      
      const imageDataUrl = imageToDataURL(finalImage);
      // 直接 await，Promise 会在用户点击确认或取消按钮时才 resolve
      const confirmed = await debugConfirmCallback(imageDataUrl);
      if (!confirmed) {
        await worker.terminate();
        throw new Error('OCR 已取消');
      }
    }

    // 使用 recognize 方法（使用裁剪後的圖片）
    // 注意：由於 logger 函數無法透過 postMessage 傳遞給 Worker，
    // 我們暫時移除詳細的進度追蹤以避免 DataCloneError
    // OCR 功能會正常運作，但進度條會在完成時直接跳到 100%
    ocrDebugLog('performOCR: 開始執行 recognize', {
      imageWidth: finalImage.width,
      imageHeight: finalImage.height,
      isCropped: finalImage !== image,
      timestamp: new Date().toISOString(),
    });
    const recognizeStart = Date.now();
    const result = await worker.recognize(finalImage);
    const recognizeEnd = Date.now();
    ocrDebugLog('performOCR: recognize 完成', {
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
      ocrDebugLog('performOCR: 更新進度回調', {
        progress: 1.0,
        timestamp: new Date().toISOString(),
      });
      // 由於無法直接獲取詳細進度，我們可以模擬進度更新
      // 或者只在完成時設置為 100%
      onProgress(1.0);
    }

    // 如果使用了裁剪後的圖片，清理臨時圖片URL（如果有）
    if (finalImage !== image && finalImage.src.startsWith('data:')) {
      // 注意：Image 對象的 src 如果是 data URL，不需要手動清理
      // 但我們可以記錄一下
      ocrDebugLog('performOCR: 使用裁剪後的圖片完成識別', {
        timestamp: new Date().toISOString(),
      });
    }

    ocrDebugLog('performOCR: 開始終止 Worker', {
      timestamp: new Date().toISOString(),
    });
    const terminateStart = Date.now();
    await worker.terminate();
    const terminateEnd = Date.now();
    ocrDebugLog('performOCR: Worker 終止完成', {
      duration: terminateEnd - terminateStart,
      timestamp: new Date().toISOString(),
    });

    // ===== 後處理階段：嚴格過濾，確保只檢索繁體中文 =====
    // Filter 順序（不可改變，避免互相干擾）：
    // 1. Confidence 過濾：過濾低信心度的單詞（基於 words 數據）
    // 2. 清理空白：合併連續空白，統一換行符
    // 3. 繁體中文過濾：嚴格過濾，只保留繁體中文 Unicode 範圍
    // 4. 白名單驗證：如果使用 itemtw 白名單，驗證結果（僅記錄警告）
    
    // Step 1: 過濾低 confidence 的單詞
    // 注意：當 minConfidence 為 0 時，跳過此步驟，直接使用原始文本以避免過度過濾
    let filteredText = result.data.text;
    
    // 只有在 minConfidence > 0 時才進行 confidence 過濾
    // 當 minConfidence 為 0 時，保留所有識別結果，避免過度過濾導致識別不準確
    if (getConfig().minConfidence > 0 && result.data.words && result.data.words.length > 0) {
      ocrDebugLog('performOCR: Step 1 - 開始過濾低 confidence 單詞', {
        totalWords: result.data.words.length,
        minConfidence: getConfig().minConfidence,
        timestamp: new Date().toISOString(),
      });

      // 計算平均字符高度，用於更智能的行檢測
      const wordHeights = result.data.words
        .map((w) => w.bbox ? w.bbox.y1 - w.bbox.y0 : 0)
        .filter((h) => h > 0);
      const avgHeight = wordHeights.length > 0
        ? wordHeights.reduce((sum, h) => sum + h, 0) / wordHeights.length
        : 20; // 默認值
      
      // 使用字符高度的 30% 作為行檢測閾值（更寬鬆的行檢測）
      const lineThreshold = Math.max(5, avgHeight * 0.3);
      
      // 先按位置排序所有單詞（包括低 confidence 的），確保按照正確的閱讀順序（從上到下，從左到右）
      // 這樣即使低 confidence 的字符位置不準確，也能保持相對正確的順序
      const sortedWords = [...result.data.words].sort((a, b) => {
        // 計算字符的中心 Y 位置（更穩定，不受字符高度影響）
        const aCenterY = (a.bbox.y0 + a.bbox.y1) / 2;
        const bCenterY = (b.bbox.y0 + b.bbox.y1) / 2;
        
        // 如果垂直位置差異超過閾值，則認為在不同行，按 Y 排序
        if (Math.abs(aCenterY - bCenterY) > lineThreshold) {
          return aCenterY - bCenterY;
        }
        
        // 同一行內，按 X 位置排序（從左到右）
        // 使用 x0（左邊界）進行排序，確保閱讀順序正確
        // 如果 x0 相同，則使用 x1（右邊界）作為次要排序條件
        if (Math.abs(a.bbox.x0 - b.bbox.x0) < 1) {
          return a.bbox.x1 - b.bbox.x1;
        }
        return a.bbox.x0 - b.bbox.x0;
      });

      // 構建過濾後的文字：按照已排序的順序處理，低 confidence 的單詞用空格替換
      // 這樣可以保持正確的字符順序，即使某些字符的 confidence 較低
      const filteredParts: string[] = [];
      sortedWords.forEach((word, index) => {
        if (word.confidence >= getConfig().minConfidence && word.text.trim().length > 0) {
          // 高 confidence 單詞：保留文字
          filteredParts.push(word.text);
        } else {
          // 低 confidence 單詞：用空格替換，保持位置
          // 根據單詞長度插入對應數量的空格，保持相對位置
          const spaceCount = Math.max(1, Math.ceil(word.text.length));
          filteredParts.push(' '.repeat(spaceCount));
        }
      });

      filteredText = filteredParts.join('');

      const removedCount = sortedWords.filter(
        (w) => w.confidence < getConfig().minConfidence || w.text.trim().length === 0
      ).length;

      ocrDebugLog('performOCR: Step 1 - confidence 過濾完成', {
        originalWordCount: result.data.words.length,
        filteredWordCount: sortedWords.length - removedCount,
        removedWordCount: removedCount,
        removedWords: sortedWords
          .filter((w) => w.confidence < getConfig().minConfidence || w.text.trim().length === 0)
          .map((w) => ({ text: w.text, confidence: w.confidence })),
        filteredTextPreview: filteredText.substring(0, 100),
        timestamp: new Date().toISOString(),
      });
    } else {
      if (getConfig().minConfidence === 0) {
        ocrDebugLog('performOCR: Step 1 - minConfidence 為 0，跳過 confidence 過濾，保留所有識別結果', {
          originalTextLength: result.data.text.length,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.warn('[OCR DEBUG] performOCR: Step 1 - 沒有 words 資料，跳過 confidence 過濾', {
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Step 2: 清理多餘空白，但保留單個空格（用於標記缺失字符的位置）
    // 將多個連續空格合併為單個空格
    const cleanedText = filteredText
      .replace(/\s+/g, ' ')  // 多個空白合併為單個空格
      .replace(/\n+/g, ' ')  // 換行符轉為空格
      .trim();

    ocrDebugLog('performOCR: Step 2 - 清理後的文字', {
      originalLength: result.data.text.length,
      filteredLength: filteredText.length,
      cleanedLength: cleanedText.length,
      cleanedText,
      timestamp: new Date().toISOString(),
    });

    // Step 3: 過濾非中文字符（但保留數字和常見符號以提高識別準確度）
    // 優先保留繁體中文字，但如果過濾後文本為空或過短，則保留更多字符
    let processedText = filterChineseOnly(cleanedText);
    
    // 檢查過濾後的文本是否過短（少於原文本的 30%），如果是則可能過度過濾
    const originalLength = cleanedText.trim().length;
    const filteredLength = processedText.trim().length;
    const filterRatio = originalLength > 0 ? filteredLength / originalLength : 0;
    
    // 如果過濾後文本為空或過短（少於原文本的 30%），回退到清理後的文本
    // 這樣可以避免過度過濾導致識別不準確
    if ((processedText.trim().length === 0 || filterRatio < 0.3) && cleanedText.trim().length > 0) {
      console.warn('[OCR DEBUG] performOCR: Step 3 - 繁體中文過濾後文本過短，回退到清理後的文本以避免過度過濾', {
        cleanedText,
        filteredText: processedText,
        originalLength,
        filteredLength,
        filterRatio: filterRatio.toFixed(2),
        timestamp: new Date().toISOString(),
      });
      processedText = cleanedText;
    }
    
    // 如果清理後的文本也為空，回退到原始 OCR 結果
    if (processedText.trim().length === 0 && result.data.text.trim().length > 0) {
      console.warn('[OCR DEBUG] performOCR: Step 3 - 清理後文本也為空，回退到原始 OCR 結果', {
        originalText: result.data.text,
        timestamp: new Date().toISOString(),
      });
      processedText = result.data.text.trim();
    }
    
    ocrDebugLog('performOCR: Step 3 - 繁體中文過濾完成', {
      beforeFilter: cleanedText,
      afterFilter: processedText,
      removedChars: cleanedText.length - processedText.length,
      timestamp: new Date().toISOString(),
    });
    
    // Step 4: 如果使用 itemtw 白名單，進行額外驗證（僅記錄警告，不強制過濾）
    // 注意：由於識別階段已設置 whitelist，理論上不應該出現非白名單字符
    // 但保留此驗證作為安全檢查，確保識別結果符合預期
    if (effectiveOptions.useItemtwWhitelist) {
      const isValid = validateAgainstWhitelist(processedText);
      if (!isValid) {
        console.warn('[OCR DEBUG] performOCR: Step 4 - 識別結果包含不在白名單中的字符（應不應發生）', {
          text: processedText,
          timestamp: new Date().toISOString(),
        });
      } else {
        ocrDebugLog('performOCR: Step 4 - 白名單驗證通過', {
          timestamp: new Date().toISOString(),
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    
    // 計算平均置信度（如果有 words 數據）
    let avgConfidence = 0;
    if (result.data.words && result.data.words.length > 0) {
      const validWords = result.data.words.filter(w => w.confidence >= getConfig().minConfidence);
      if (validWords.length > 0) {
        avgConfidence = validWords.reduce((sum, w) => sum + w.confidence, 0) / validWords.length;
      }
    }
    
    ocrDebugLog('performOCR: OCR 識別完成', {
      totalDuration,
      originalText: result.data.text,
      cleanedText,
      finalTextLength: processedText.length,
      finalText: processedText,
      avgConfidence: avgConfidence > 0 ? avgConfidence.toFixed(2) : 'N/A',
      timestamp: new Date().toISOString(),
    });

    // 為搜尋評分提供：高信心度單詞列表（依顯示順序）與平均信心度，供 order-first + 字級信心權重使用
    let ocrWords: Array<{ text: string; confidence: number }> | undefined;
    let ocrConfidence: number | undefined;
    if (result.data.words && result.data.words.length > 0) {
      const wordHeights = result.data.words
        .map((w) => (w.bbox ? w.bbox.y1 - w.bbox.y0 : 0))
        .filter((h) => h > 0);
      const avgHeight = wordHeights.length > 0 ? wordHeights.reduce((s, h) => s + h, 0) / wordHeights.length : 20;
      const lineThreshold = Math.max(5, avgHeight * 0.3);
      const sorted = [...result.data.words].sort((a, b) => {
        const aCenterY = (a.bbox.y0 + a.bbox.y1) / 2;
        const bCenterY = (b.bbox.y0 + b.bbox.y1) / 2;
        if (Math.abs(aCenterY - bCenterY) > lineThreshold) return aCenterY - bCenterY;
        if (Math.abs(a.bbox.x0 - b.bbox.x0) < 1) return a.bbox.x1 - b.bbox.x1;
        return a.bbox.x0 - b.bbox.x0;
      });
      const highConf = sorted.filter((w) => w.confidence >= getConfig().minConfidence && w.text.trim().length > 0);
      if (highConf.length > 0) {
        ocrWords = highConf.map((w) => ({ text: w.text.trim(), confidence: w.confidence }));
        ocrConfidence = highConf.reduce((s, w) => s + w.confidence, 0) / highConf.length;
      }
    }
    return { text: processedText, ocrWords, ocrConfidence };
  } catch (error) {
    // 使用者按取消為正常行為，不當成辨識失敗
    if (error instanceof Error && error.message === 'OCR 已取消') {
      throw error;
    }
    const totalDuration = Date.now() - startTime;
    ocrDebugLog('performOCR: OCR 識別錯誤', {
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
  ocrDebugLog('loadImageFromClipboard: 開始從剪貼簿讀取圖片', {
    itemCount: clipboardData.items.length,
    timestamp: new Date().toISOString(),
  });

  return new Promise((resolve, reject) => {
    const items = clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      ocrDebugLog('loadImageFromClipboard: 檢查剪貼簿項目', {
        index: i,
        type: item.type,
        kind: item.kind,
        timestamp: new Date().toISOString(),
      });

      if (item.type.indexOf('image') !== -1) {
        ocrDebugLog('loadImageFromClipboard: 找到圖片項目', {
          type: item.type,
          timestamp: new Date().toISOString(),
        });

        const blob = item.getAsFile();
        if (!blob) {
          ocrDebugLog('loadImageFromClipboard: 無法取得檔案', {
            itemType: item.type,
            itemKind: item.kind,
            timestamp: new Date().toISOString(),
          });
          reject(new Error('無法讀取剪貼簿中的圖片檔案，請確認圖片已正確複製'));
          return;
        }

        ocrDebugLog('loadImageFromClipboard: 開始讀取 Blob', {
          blobSize: blob.size,
          blobType: blob.type,
          timestamp: new Date().toISOString(),
        });

        const reader = new FileReader();
        reader.onload = (e) => {
          ocrDebugLog('loadImageFromClipboard: FileReader onload', {
            resultLength: (e.target?.result as string)?.length,
            timestamp: new Date().toISOString(),
          });

          const img = new Image();
          img.onload = () => {
            ocrDebugLog('loadImageFromClipboard: Image onload 成功', {
              width: img.width,
              height: img.height,
              timestamp: new Date().toISOString(),
            });
            resolve(img);
          };
          img.onerror = (error) => {
            ocrDebugLog('loadImageFromClipboard: Image onerror', {
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
          ocrDebugLog('loadImageFromClipboard: FileReader onerror', {
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
    ocrDebugLog('loadImageFromClipboard: 剪貼簿中沒有圖片', {
      itemCount: items.length,
      itemTypes: Array.from(items).map((item) => item.type),
      itemKinds: Array.from(items).map((item) => item.kind),
      timestamp: new Date().toISOString(),
    });
    reject(new Error('剪貼簿中沒有圖片，請先複製圖片後再貼上'));
  });
}

/**
 * 生成最終預覽圖片（包含所有 filter 處理）
 * 用於在 UI 中顯示最終會輸入到 OCR 的圖片
 */
async function generateFinalPreview(
  file: File,
  filterOptions?: {
    enableAdvancedProcessing?: boolean;
    enableAutoThreshold?: boolean;
    enableAutoTextDetection?: boolean;
    useItemtwWhitelist?: boolean;
    excludeSymbolsAndNumbers?: boolean;
    invertForLightText?: boolean;
  }
): Promise<string> {
  ocrDebugLog('generateFinalPreview: 開始生成最終預覽', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    timestamp: new Date().toISOString(),
  });

  try {
    // 步驟 1: 載入圖片
    const img = await loadImage(file);
    ocrDebugLog('generateFinalPreview: 圖片載入完成', {
      loadedImageSize: { width: img.width, height: img.height },
      timestamp: new Date().toISOString(),
    });

    // 步驟 2: 檢查並縮放圖片
    const resizedImage = await resizeImageIfNeeded(img);
    ocrDebugLog('generateFinalPreview: 圖片縮放完成', {
      resizedImageSize: { width: resizedImage.width, height: resizedImage.height },
      wasResized: resizedImage !== img,
      timestamp: new Date().toISOString(),
    });

    // 步驟 3: 應用所有 filter
    // 確保傳遞完整的 filter 配置，包括 getConfig().filters 中的所有開關
    const fullFilterOptions = {
      ...filterOptions,
      filters: getConfig().filters, // 傳遞完整的 filter 配置
    };
    const processedImage = await preprocessImage(resizedImage, fullFilterOptions);
    ocrDebugLog('generateFinalPreview: Filter 處理完成', {
      processedImageSize: { width: processedImage.width, height: processedImage.height },
      timestamp: new Date().toISOString(),
    });

    // 步驟 4: 轉換為 data URL
    const dataURL = imageToDataURL(processedImage);
    ocrDebugLog('generateFinalPreview: 預覽生成完成', {
      dataURLLength: dataURL.length,
      timestamp: new Date().toISOString(),
    });

    return dataURL;
  } catch (error) {
    ocrDebugLog('generateFinalPreview: 生成預覽失敗', {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
    // 如果處理失敗，返回原始圖片的 data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(error);
      reader.readAsDataURL(file);
    });
  }
}

/**
 * 處理圖片並執行 OCR
 */
async function processImageForOCR(
  file: File,
  filterOptions?: {
    enableAdvancedProcessing?: boolean;
    enableAutoThreshold?: boolean;
    enableAutoTextDetection?: boolean;
    useItemtwWhitelist?: boolean;
    excludeSymbolsAndNumbers?: boolean;
    invertForLightText?: boolean;
  },
  onProgress?: (p: number) => void,
  debugConfirmCallback?: (imageDataUrl: string) => Promise<boolean>
): Promise<{ text: string; ocrWords?: Array<{ text: string; confidence: number }>; ocrConfidence?: number }> {
  const startTime = Date.now();
  ocrDebugLog('processImageForOCR: 開始處理圖片', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    hasProgressCallback: !!onProgress,
    timestamp: new Date().toISOString(),
  });

  try {
    ocrDebugLog('processImageForOCR: 步驟 1/4 - 載入圖片', {
      timestamp: new Date().toISOString(),
    });
    const img = await loadImage(file);
    ocrDebugLog('processImageForOCR: 步驟 1/4 完成', {
      loadedImageSize: { width: img.width, height: img.height },
      timestamp: new Date().toISOString(),
    });

    ocrDebugLog('processImageForOCR: 步驟 2/4 - 檢查並縮放圖片', {
      inputSize: { width: img.width, height: img.height },
      maxDimension: getConfig().maxImageDimension,
      timestamp: new Date().toISOString(),
    });
    const resizedImage = await resizeImageIfNeeded(img);
    ocrDebugLog('processImageForOCR: 步驟 2/4 完成', {
      resizedImageSize: { width: resizedImage.width, height: resizedImage.height },
      wasResized: resizedImage !== img,
      timestamp: new Date().toISOString(),
    });

    ocrDebugLog('processImageForOCR: 步驟 3/4 - 圖片前處理', {
      inputSize: { width: resizedImage.width, height: resizedImage.height },
      timestamp: new Date().toISOString(),
    });
    const processedImage = await preprocessImage(resizedImage, filterOptions);
    ocrDebugLog('processImageForOCR: 步驟 3/4 完成', {
      processedImageSize: { width: processedImage.width, height: processedImage.height },
      timestamp: new Date().toISOString(),
    });

    ocrDebugLog('processImageForOCR: 步驟 4/4 - 執行 OCR', {
      hasDebugCallback: !!debugConfirmCallback,
      timestamp: new Date().toISOString(),
    });
    const ocrResult = await performOCR(processedImage, filterOptions, onProgress, debugConfirmCallback);
    ocrDebugLog('processImageForOCR: 步驟 4/4 完成', {
      timestamp: new Date().toISOString(),
    });

    const text = typeof ocrResult === 'object' && ocrResult !== null && 'text' in ocrResult ? ocrResult.text : String(ocrResult);
    const finalText = text.trim();
    const totalDuration = Date.now() - startTime;
    ocrDebugLog('processImageForOCR: 所有步驟完成', {
      totalDuration,
      finalTextLength: finalText.length,
      finalText,
      hasOcrMeta: typeof ocrResult === 'object' && ocrResult !== null && ('ocrWords' in ocrResult || 'ocrConfidence' in ocrResult),
      timestamp: new Date().toISOString(),
    });

    if (typeof ocrResult === 'object' && ocrResult !== null) {
      return { text: finalText, ocrWords: (ocrResult as { ocrWords?: Array<{ text: string; confidence: number }> }).ocrWords, ocrConfidence: (ocrResult as { ocrConfidence?: number }).ocrConfidence };
    }
    return { text: finalText };
  } catch (error) {
    // 使用者按取消為正常行為，不當成錯誤記錄
    if (error instanceof Error && error.message === 'OCR 已取消') {
      throw error;
    }
    const totalDuration = Date.now() - startTime;
    ocrDebugLog('processImageForOCR: 處理過程發生錯誤', {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      totalDuration,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

/** 供搜尋評分使用：高信心度單詞（依顯示順序）與平均信心度 */
export type OCROutputMeta = {
  ocrWords?: Array<{ text: string; confidence: number }>;
  ocrConfidence?: number;
};

interface OCRButtonProps {
  onTextRecognized?: (text: string, meta?: OCROutputMeta) => void;
  disabled?: boolean;
}

/**
 * OCR 按鈕組件
 */
export default function OCRButton({
  onTextRecognized,
  disabled,
}: OCRButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  // Debug 模式確認框狀態
  const [debugPreviewImage, setDebugPreviewImage] = useState<string | null>(null);
  const [debugConfirmResolve, setDebugConfirmResolve] = useState<((confirmed: boolean) => void) | null>(null);
  // 使用 ref 存储 resolve 函数，避免状态更新延迟问题
  const debugConfirmResolveRef = useRef<((confirmed: boolean) => void) | null>(null);
  // Filter 選項狀態（使用 getConfig().filters 中的開關配置）
  const filterOptions = {
    enableAdvancedProcessing: true, // 啟用進階處理
    enableAutoThreshold: getConfig().filters.enableAutoThreshold, // 使用 filter 開關
    invertForLightText: getConfig().filters.enableInvertForLightText, // 使用 filter 開關
    enableAutoTextDetection: getConfig().filters.enableAutoTextDetection, // 使用 filter 開關（自動裁剪）
    useItemtwWhitelist: true, // 白名單模式默認開啟
    excludeSymbolsAndNumbers: false, // 排除符號數字（保持關閉以獲得最佳識別準確度）
  };
  // 預覽圖不再需要處理後的版本（始終使用原圖）
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Debug 模式確認框處理函數
  const handleDebugConfirm = useCallback((imageDataUrl: string): Promise<boolean> => {
    return new Promise((resolve) => {
      debugConfirmResolveRef.current = (confirmed: boolean) => {
        setDebugPreviewImage(null);
        setDebugConfirmResolve(null);
        debugConfirmResolveRef.current = null;
        resolve(confirmed);
      };
      setDebugPreviewImage(imageDataUrl);
      setDebugConfirmResolve(() => () => {});
    });
  }, []);

  const handleDebugConfirmClick = useCallback((confirmed: boolean) => {
    const resolveFn = debugConfirmResolveRef.current || debugConfirmResolve;
    if (resolveFn) {
      resolveFn(confirmed);
    }
  }, [debugConfirmResolve]);


  const handleImageProcess = useCallback(
    async (file: File) => {
      ocrDebugLog('handleImageProcess: 開始處理', {
        fileName: file?.name,
        fileSize: file?.size,
        fileType: file?.type,
        isImage: file?.type.startsWith('image/'),
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

      ocrDebugLog('handleImageProcess: 設置處理狀態', {
        timestamp: new Date().toISOString(),
      });
      setIsProcessing(true);
      setProgress(0);

      try {
        const debugCallback = getConfig().debugMode ? handleDebugConfirm : undefined;
        const finalFilterOptions = filterOptions;
        ocrDebugLog('handleImageProcess: 調用 processImageForOCR', {
          filterOptions: finalFilterOptions,
          enableAutoTextDetection: finalFilterOptions.enableAutoTextDetection,
          note: '所有檢測和裁剪邏輯統一由 enableAutoTextDetection 控制',
          debugMode: getConfig().debugMode,
          hasDebugCallback: !!debugCallback,
          timestamp: new Date().toISOString(),
        });
        const recognized = await processImageForOCR(file, finalFilterOptions, (prog) => {
          ocrDebugLog('handleImageProcess: 進度更新', {
            progress: prog,
            progressPercent: Math.round(prog * 100),
            timestamp: new Date().toISOString(),
          });
          setProgress(prog);
        }, debugCallback);

        const recognizedText = typeof recognized === 'string' ? recognized : recognized?.text ?? '';
        const ocrMeta: OCROutputMeta | undefined =
          typeof recognized === 'object' && recognized !== null && ('ocrWords' in recognized || 'ocrConfidence' in recognized)
            ? { ocrWords: recognized.ocrWords, ocrConfidence: recognized.ocrConfidence }
            : undefined;

        ocrDebugLog('handleImageProcess: OCR 完成', {
          recognizedTextLength: recognizedText?.length || 0,
          recognizedText,
          hasOcrMeta: !!ocrMeta,
          hasOnTextRecognized: !!onTextRecognized,
          timestamp: new Date().toISOString(),
        });

        // 檢查識別結果是否有效（非空字符串）
        const hasValidText = recognizedText && recognizedText.trim().length > 0;

        if (hasValidText && onTextRecognized) {
          ocrDebugLog('handleImageProcess: 調用 onTextRecognized 回調', {
            text: recognizedText,
            hasOcrMeta: !!ocrMeta,
            timestamp: new Date().toISOString(),
          });
          onTextRecognized(recognizedText, ocrMeta);
          setIsModalOpen(false);
          setPreviewImage(null);
          ocrDebugLog('handleImageProcess: 關閉模態框並清除預覽', {
            timestamp: new Date().toISOString(),
          });
        } else {
          const errorReason = !hasValidText 
            ? '無法辨識文字（識別結果為空）' 
            : '缺少回調函數';
          console.warn('[OCR DEBUG] handleImageProcess: 無法辨識文字或缺少回調', {
            hasRecognizedText: !!recognizedText,
            recognizedTextLength: recognizedText?.length || 0,
            recognizedText: recognizedText,
            hasOnTextRecognized: !!onTextRecognized,
            errorReason,
            timestamp: new Date().toISOString(),
          });
          
          if (!hasValidText) {
            alert('無法辨識圖片中的文字。可能原因：\n1. 圖片中沒有文字\n2. 文字區域不清晰\n3. 文字不是繁體中文\n\n請嘗試其他圖片或調整圖片品質。');
          } else {
            alert('OCR 回調函數未設置，請聯繫開發者。');
          }
        }
      } catch (error) {
        // 使用者按取消時不顯示錯誤訊息
        if (error instanceof Error && error.message === 'OCR 已取消') {
          return;
        }
        ocrDebugLog('handleImageProcess: OCR 失敗', {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        });
        alert('OCR 辨識失敗，請稍後再試');
      } finally {
        ocrDebugLog('handleImageProcess: 清理狀態', {
          timestamp: new Date().toISOString(),
        });
        setIsProcessing(false);
        setProgress(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [onTextRecognized, handleDebugConfirm]
  );

  // 打開模態框
  const handleOCRClick = () => {
    ocrDebugLog('handleOCRClick: OCR 按鈕點擊', {
      disabled,
      isProcessing,
      willOpenModal: !disabled && !isProcessing,
      timestamp: new Date().toISOString(),
    });

    if (!disabled && !isProcessing) {
      setIsModalOpen(true);
      ocrDebugLog('handleOCRClick: 模態框已打開', {
        timestamp: new Date().toISOString(),
      });
    }
  };

  // 關閉模態框
  const handleCloseModal = () => {
    ocrDebugLog('handleCloseModal: 關閉模態框', {
      isProcessing,
      willClose: !isProcessing,
      timestamp: new Date().toISOString(),
    });

    if (!isProcessing) {
      setIsModalOpen(false);
      setPreviewImage(null);
      setIsDragging(false);
      ocrDebugLog('handleCloseModal: 模態框已關閉', {
        timestamp: new Date().toISOString(),
      });
    }
  };

  // 處理文件選擇
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    ocrDebugLog('handleFileChange: 文件選擇事件觸發', {
      fileCount: e.target.files?.length || 0,
      timestamp: new Date().toISOString(),
    });

    const file = e.target.files?.[0];
    if (file) {
      ocrDebugLog('handleFileChange: 開始處理選取的檔案', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        timestamp: new Date().toISOString(),
      });

      // 直接進入 OCR 處理（debug 模式）
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
    ocrDebugLog('handleDrop: 拖放事件觸發', {
      fileCount: e.dataTransfer.files.length,
      timestamp: new Date().toISOString(),
    });

    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      ocrDebugLog('handleDrop: 處理拖放的檔案', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        isImage: file.type.startsWith('image/'),
        timestamp: new Date().toISOString(),
      });

      if (file.type.startsWith('image/')) {
        // 直接進入 OCR 處理（debug 模式）
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
      ocrDebugLog('handlePaste: 剪貼簿貼上事件觸發', {
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
        ocrDebugLog('handlePaste: 開始從剪貼簿載入圖片', {
          timestamp: new Date().toISOString(),
        });
        const img = await loadImageFromClipboard(clipboardData);
        ocrDebugLog('handlePaste: 圖片載入成功，開始轉換為 File', {
          width: img.width,
          height: img.height,
          timestamp: new Date().toISOString(),
        });

        // 將 Image 轉換為 File
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        
        // 使用 filter 開關控制圖像平滑
        if (getConfig().filters.enableClipboardImageSmoothing) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
        } else {
          ctx.imageSmoothingEnabled = false;
        }
        
        ctx.drawImage(img, 0, 0);

        ocrDebugLog('handlePaste: 開始轉換 Canvas 為 Blob', {
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          timestamp: new Date().toISOString(),
        });

        canvas.toBlob(
          async (blob) => {
            if (blob) {
              ocrDebugLog('handlePaste: Blob 轉換成功', {
                blobSize: blob.size,
                blobType: blob.type,
                timestamp: new Date().toISOString(),
              });

              const file = new File([blob], 'pasted-image.png', {
                type: 'image/png',
              });
              // 直接進入 OCR 處理（debug 模式）
              await handleImageProcess(file);
            } else {
              ocrDebugLog('handlePaste: Blob 轉換失敗', {
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
        ocrDebugLog('handlePaste: 剪貼簿處理失敗', {
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


  // 模態框內容
  const modalContent = isModalOpen ? (
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
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
      }}
    >
      {/* 模態框主容器 */}
      <div
        className="bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 rounded-lg border-2 border-purple-500/50 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
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
            <h2 className="text-lg sm:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-pink-300 to-purple-300 drop-shadow-sm tracking-wide">
              <span className="text-xl sm:text-2xl">希德牌</span>{' '}圖片辨識
            </h2>
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
          <div className="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-500/30 rounded-lg px-3 py-1.5 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 text-center sm:text-left">
              <p className="text-sm text-white font-semibold whitespace-nowrap drop-shadow-sm">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-300 font-bold drop-shadow-[0_0_8px_rgba(251,191,36,0.6)] [text-shadow:0_0_10px_rgba(251,191,36,0.5)]">光之戰士</span>，懶得打字？
              </p>
              <p className="text-xs text-gray-200 whitespace-nowrap font-medium">
                直接截圖物品名稱，讓 OCR 幫你識別！
              </p>
            </div>
          </div>
        </div>

        {/* 內容區域（可滾動） */}
        <div 
          className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-3 p-4 sm:p-6"
        >
          {/* 拖放區域 */}
          <div className="flex-1 min-w-0">
            <div
              ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg text-center transition-all w-full box-border cursor-pointer p-6 sm:p-8 ${
              isDragging
                ? 'border-purple-400 bg-purple-900/20'
                : 'border-purple-500/50 hover:border-purple-400 hover:bg-purple-900/10'
            } ${isProcessing ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            {previewImage ? (
              /* 預覽圖片狀態 */
              <div className="w-full space-y-4">
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
              </div>
            ) : (
              /* 空狀態（未選擇圖片） */
              <div className="space-y-4 w-full flex flex-col items-center">
                {/* 主要方式：貼上 */}
                <div className="w-full text-center space-y-3">
                  <div className="flex flex-col items-center gap-2">
                    <svg
                      className="w-12 h-12 sm:w-14 sm:h-14 text-purple-400 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    <p className="text-white font-semibold text-base sm:text-lg mb-1 flex items-center justify-center gap-1.5 flex-wrap">
                      <span>使用</span>
                      <kbd className="px-2.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded text-sm font-bold border border-purple-400 text-white shadow-lg">Ctrl</kbd>
                      <span className="text-gray-300">+</span>
                      <kbd className="px-2.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded text-sm font-bold border border-purple-400 text-white shadow-lg">V</kbd>
                      <span>貼上截圖</span>
                    </p>
                    <p className="text-xs text-purple-300 font-medium">
                      💡 截圖範圍越精確，效果越好
                    </p>
                  </div>
                  
                  {/* 分隔線 */}
                  <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
                    <span className="text-xs text-gray-500">或</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
                  </div>
                  
                  {/* 次要方式：上傳 */}
                  <div className="space-y-1">
                    <p className="text-gray-400 text-sm">點擊或拖放圖片到此處</p>
                    <p className="text-xs text-gray-500">支援 JPG、PNG、GIF 等圖片格式</p>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>

          {/* 提示文字 */}
          {!isProcessing && (
            <div className="text-center flex-shrink-0">
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

      {/* Debug 模式確認框 */}
      {debugPreviewImage && (debugConfirmResolve || debugConfirmResolveRef.current) && createPortal(
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleDebugConfirmClick(false);
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
            zIndex: 10001,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <div
            className="bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 rounded-lg border-2 border-purple-500/50 shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
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
                <h2 className="text-base sm:text-lg font-semibold text-white">Debug Mode - OCR 輸入前預覽</h2>
                <button
                  onClick={() => handleDebugConfirmClick(false)}
                  className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-800/50"
                  aria-label="取消"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="bg-gradient-to-r from-yellow-900/40 to-orange-900/40 border border-yellow-500/30 rounded-lg px-3 py-1.5">
                <p className="text-sm text-white font-medium">
                  這是即將輸入到 Tesseract OCR 的圖片預覽
                </p>
              </div>
              <div className="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-500/30 rounded-lg px-3 py-1.5 mt-2">
                <p className="text-xs text-gray-300 font-medium text-center">
                  作者還在不斷優化測試，可以多多嘗試分享
                </p>
              </div>
            </div>

            {/* 內容區域 */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 flex flex-col items-center gap-4">
              {debugPreviewImage && (
                <img
                  src={debugPreviewImage || ''}
                  alt="Debug 預覽"
                  className="max-w-full max-h-[60vh] rounded-lg shadow-lg object-contain border-2 border-purple-400/50"
                />
              )}
              <div className="flex gap-3 w-full justify-center">
                <button
                  onClick={() => handleDebugConfirmClick(true)}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  確認繼續 OCR
                </button>
                <button
                  onClick={() => handleDebugConfirmClick(false)}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

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
