/**
 * 圖片處理工具函數
 */

import { OCR_CONFIG } from './config';
import type { OCRFilterOptions } from './types';

/**
 * 載入圖片檔案為 Image 物件
 */
export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 若圖片尺寸過大則縮放
 */
export function resizeImageIfNeeded(image: HTMLImageElement): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const maxDim = OCR_CONFIG.maxImageDimension;
    const { width, height } = image;

    if (width <= maxDim && height <= maxDim) {
      resolve(image);
      return;
    }

    const scale = Math.min(maxDim / width, maxDim / height);
    const newWidth = Math.floor(width * scale);
    const newHeight = Math.floor(height * scale);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = newWidth;
    canvas.height = newHeight;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, newWidth, newHeight);

    const resizedImg = new Image();
    resizedImg.onload = () => resolve(resizedImg);
    resizedImg.src = canvas.toDataURL('image/png');
  });
}

/**
 * 計算 Otsu 閾值
 */
export function calculateOtsuThreshold(imageData: ImageData): number {
  const data = imageData.data;
  const histogram = new Array(256).fill(0);
  const totalPixels = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
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
export function applyMedianFilter(imageData: ImageData, radius = 1): ImageData {
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
 * 高斯模糊
 */
export function applyGaussianBlur(imageData: ImageData, radius = 1): ImageData {
  const { data, width, height } = imageData;
  const newData = new Uint8ClampedArray(data);
  
  let kernel: number[][];
  let kernelSum: number;
  let kernelRadius: number;
  
  if (radius === 1) {
    kernel = [[1, 2, 1], [2, 4, 2], [1, 2, 1]];
    kernelSum = 16;
    kernelRadius = 1;
  } else if (radius === 2) {
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
    kernel = [[1, 2, 1], [2, 4, 2], [1, 2, 1]];
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
 * 去除細小網格線
 */
export function removeGridLines(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const newData = new Uint8ClampedArray(data);
  const smoothRadius = 2;
  
  for (let y = smoothRadius; y < height - smoothRadius; y++) {
    for (let x = smoothRadius; x < width - smoothRadius; x++) {
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
      const diff = Math.abs(current - avg);
      
      if (diff < 30) {
        newData[idx] = avg;
        newData[idx + 1] = avg;
        newData[idx + 2] = avg;
      } else {
        newData[idx] = current;
        newData[idx + 1] = current;
        newData[idx + 2] = current;
      }
    }
  }
  
  return new ImageData(newData, width, height);
}

/**
 * 雙邊濾波
 */
export function applyBilateralFilter(imageData: ImageData, radius = 2): ImageData {
  const { data, width, height } = imageData;
  const newData = new Uint8ClampedArray(data);
  
  const spatialSigma = radius * 0.8;
  const colorSigma = 40;
  
  const spatialWeights: number[][] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    spatialWeights[dy + radius] = [];
    for (let dx = -radius; dx <= radius; dx++) {
      const spatialDist = Math.sqrt(dx * dx + dy * dy);
      spatialWeights[dy + radius][dx + radius] = Math.exp(-(spatialDist * spatialDist) / (2 * spatialSigma * spatialSigma));
    }
  }
  
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
 * 形態學開運算
 */
export function applyMorphologyOpen(imageData: ImageData, kernelSize = 2): ImageData {
  const { data, width, height } = imageData;
  const newData = new Uint8ClampedArray(data);
  
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
 * 形態學閉運算
 */
export function applyMorphologyClose(imageData: ImageData, kernelSize = 2): ImageData {
  const { data, width, height } = imageData;
  const newData = new Uint8ClampedArray(data);
  
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
 * 銳化濾波
 */
export function applySharpen(imageData: ImageData, strength: 'normal' | 'strong' = 'normal'): ImageData {
  const { data, width, height } = imageData;
  const newData = new Uint8ClampedArray(data);
  
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
 */
export function detectLightTextOnDarkBackground(imageData: ImageData): boolean {
  const { data } = imageData;
  const brightnessValues: number[] = [];
  
  for (let i = 0; i < data.length; i += 40) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    brightnessValues.push(gray);
  }
  
  const avgBrightness = brightnessValues.reduce((a, b) => a + b, 0) / brightnessValues.length;
  const variance = brightnessValues.reduce((sum, val) => sum + Math.pow(val - avgBrightness, 2), 0) / brightnessValues.length;
  const stdDev = Math.sqrt(variance);
  
  return avgBrightness < 120 && stdDev > 40;
}

/**
 * 反轉圖像
 */
export function invertImage(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const newData = new Uint8ClampedArray(data);
  
  for (let i = 0; i < data.length; i += 4) {
    newData[i] = 255 - data[i];
    newData[i + 1] = 255 - data[i + 1];
    newData[i + 2] = 255 - data[i + 2];
    newData[i + 3] = data[i + 3];
  }
  
  return new ImageData(newData, width, height);
}

/**
 * 自適應對比度增強
 */
export function enhanceContrastForDarkBackground(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const newData = new Uint8ClampedArray(data);
  
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
  
  const variance = brightnessValues.reduce((sum, val) => sum + Math.pow(val - avgBrightness, 2), 0) / brightnessValues.length;
  const stdDev = Math.sqrt(variance);
  
  const isLightTextOnDark = avgBrightness < 120 && stdDev > 40;
  
  let contrastFactor: number;
  let brightnessShift: number;
  
  if (isLightTextOnDark) {
    contrastFactor = 3.0;
    brightnessShift = 30;
  } else if (avgBrightness < 100) {
    contrastFactor = 2.5;
    brightnessShift = -20;
  } else {
    contrastFactor = 1.8;
    brightnessShift = 0;
  }

  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    
    let enhanced = (gray - 128) * contrastFactor + 128 + brightnessShift;
    enhanced = Math.max(0, Math.min(255, enhanced));
    
    newData[i] = enhanced;
    newData[i + 1] = enhanced;
    newData[i + 2] = enhanced;
    newData[i + 3] = data[i + 3];
  }

  return new ImageData(newData, width, height);
}

/**
 * 圖片前處理
 */
export async function preprocessImage(
  image: HTMLImageElement,
  filterOptions?: OCRFilterOptions
): Promise<HTMLImageElement> {
  const effectiveOptions = {
    enableAdvancedProcessing: filterOptions?.enableAdvancedProcessing ?? OCR_CONFIG.enableAdvancedProcessing,
    enableAutoThreshold: filterOptions?.enableAutoThreshold ?? OCR_CONFIG.enableAutoThreshold,
    invertForLightText: filterOptions?.invertForLightText ?? OCR_CONFIG.invertForLightText,
  };

  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    const scale = OCR_CONFIG.imageScale;
    const width = Math.floor(image.width * scale);
    const height = Math.floor(image.height * scale);

    canvas.width = width;
    canvas.height = height;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, width, height);

    let imageData = ctx.getImageData(0, 0, width, height);

    // 灰階化
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
    ctx.putImageData(imageData, 0, 0);
    imageData = ctx.getImageData(0, 0, width, height);

    // 對比度增強
    imageData = enhanceContrastForDarkBackground(imageData);

    // 檢測並反轉圖像
    if (effectiveOptions.invertForLightText) {
      const isLightText = detectLightTextOnDarkBackground(imageData);
      if (isLightText) {
        imageData = invertImage(imageData);
      }
    }

    // 進階處理
    if (effectiveOptions.enableAdvancedProcessing) {
      imageData = applyBilateralFilter(imageData, 2);
      imageData = removeGridLines(imageData);
      imageData = applyGaussianBlur(imageData, 2);
      imageData = applyMedianFilter(imageData, 1);
    }

    // 銳化
    imageData = applySharpen(imageData, OCR_CONFIG.sharpenStrength);

    // 二值化
    const threshold = effectiveOptions.enableAutoThreshold
      ? calculateOtsuThreshold(imageData)
      : OCR_CONFIG.threshold;

    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i];
      const value = gray > threshold ? 255 : 0;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }
    ctx.putImageData(imageData, 0, 0);
    imageData = ctx.getImageData(0, 0, width, height);

    // 形態學處理
    if (effectiveOptions.enableAdvancedProcessing) {
      imageData = applyMorphologyOpen(imageData, 1);
      if (OCR_CONFIG.enableMorphologyClose) {
        imageData = applyMorphologyClose(imageData, OCR_CONFIG.morphologyCloseKernelSize);
      }
    }

    ctx.putImageData(imageData, 0, 0);

    const processedImg = new Image();
    processedImg.onload = () => resolve(processedImg);
    processedImg.src = canvas.toDataURL('image/png');
  });
}

/**
 * 自動裁剪圖片
 */
export function autoCropImage(image: HTMLImageElement, region: { x: number; y: number; width: number; height: number }): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    canvas.width = region.width;
    canvas.height = region.height;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    ctx.drawImage(
      image,
      region.x, region.y, region.width, region.height,
      0, 0, region.width, region.height
    );

    const croppedImg = new Image();
    croppedImg.onload = () => resolve(croppedImg);
    croppedImg.onerror = () => reject(new Error('自動裁剪失敗'));
    croppedImg.src = canvas.toDataURL('image/png');
  });
}

/**
 * 從剪貼簿讀取圖片
 */
export function loadImageFromClipboard(clipboardData: DataTransfer): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const items = clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const blob = item.getAsFile();
        if (!blob) {
          reject(new Error('無法讀取剪貼簿中的圖片檔案'));
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('圖片格式不正確或已損壞'));
          img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error('讀取剪貼簿圖片時發生錯誤'));
        reader.readAsDataURL(blob);
        return;
      }
    }
    reject(new Error('剪貼簿中沒有圖片'));
  });
}

/**
 * 過濾文字，只保留繁體中文
 */
export function filterChineseOnly(text: string): string {
  return text
    .replace(/[^\u3400-\u4DBF\u4E00-\u9FFF\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
