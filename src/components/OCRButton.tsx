import { useState, useRef, useEffect, useCallback } from 'react';
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
const CONFIG = {
  tesseractLang: 'chi_tra', // 只支援繁體中文
  imageScale: 3.0, // 提高放大倍數以提升識別度
  threshold: 128,
  maxImageDimension: 2000,
  enableAdvancedProcessing: true, // 啟用進階處理以提升識別度
  enableAutoThreshold: true, // 啟用自動閾值
  minConfidence: 5, // 最低信心度閾值（0-100），低於此值的單詞會被過濾掉（設為 5 以保留幾乎所有識別結果，只過濾極低把握度的結果）
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
 * 圖片前處理：放大 + 灰階 + 對比度 + 二值化 + 去噪
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

    // 啟用進階處理（去噪）
    if (CONFIG.enableAdvancedProcessing) {
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

    const data = imageData.data;

    // 自動閾值
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

    // 灰階 + 對比度提升 + 二值化
    const contrast = 1.8; // 提高對比度以提升識別度
    console.log('[OCR DEBUG] preprocessImage: 開始灰階化、對比度提升、二值化', {
      contrast,
      threshold,
      pixelCount: data.length / 4,
      timestamp: new Date().toISOString(),
    });

    const beforeProcessing = Date.now();
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      );

      let enhanced = (gray - 128) * contrast + 128;
      enhanced = Math.max(0, Math.min(255, enhanced));

      const binary = enhanced > threshold ? 255 : 0;

      data[i] = binary;
      data[i + 1] = binary;
      data[i + 2] = binary;
    }
    const afterProcessing = Date.now();

    console.log('[OCR DEBUG] preprocessImage: 像素處理完成', {
      duration: afterProcessing - beforeProcessing,
      timestamp: new Date().toISOString(),
    });

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
    const params = {
      tessedit_char_whitelist: '', // 不限制字符，允許所有繁體中文字符
      tessedit_pageseg_mode: '6', // 統一文本塊
      // 提升識別準確度的參數
      tessedit_ocr_engine_mode: '1', // LSTM OCR Engine（更準確）
      classify_bln_numeric_mode: '0', // 不限制為數字模式
      textord_min_linesize: '2.5', // 最小行尺寸
      classify_enable_learning: '0', // 禁用學習模式以保持一致性
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
export default function OCRButton({
  onTextRecognized,
  disabled,
}: OCRButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // 處理圖片識別
  const handleImageProcess = useCallback(
    async (file: File) => {
      console.log('[OCR DEBUG] handleImageProcess: 開始處理', {
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
      console.log('[OCR DEBUG] handleCloseModal: 模態框已關閉', {
        timestamp: new Date().toISOString(),
      });
    }
  };

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
        <div className="flex flex-col p-4 sm:p-6 border-b border-purple-500/30 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg sm:text-xl font-semibold text-white">OCR 圖片識別</h2>
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
          <div className="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-500/30 rounded-lg p-3 text-center">
            <p className="text-sm text-white font-medium mb-1">
              <span className="text-purple-300">光之戰士</span>，懶得打字？
            </p>
            <p className="text-xs text-gray-300">
              直接截圖物品名稱，讓 OCR 幫你識別！
            </p>
          </div>
        </div>

        {/* 內容區域（可滾動） */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0">
          {/* 拖放區域 */}
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 sm:p-8 text-center cursor-pointer transition-all w-full box-border ${
              isDragging
                ? 'border-purple-400 bg-purple-900/20'
                : 'border-purple-500/50 hover:border-purple-400 hover:bg-purple-900/10'
            } ${isProcessing ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            {previewImage ? (
              /* 預覽圖片狀態 */
              <div className="space-y-4 w-full">
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
                    💡 懶得打字？截圖物品名稱試試吧！
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
            <span className="hidden mid:inline whitespace-nowrap">OCR</span>
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
