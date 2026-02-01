/**
 * OCR 核心功能
 */

import { OCR_CONFIG } from './config';
import { TESSERACT_INIT_CONFIG } from './tesseractConfig';
import type { OCRFilterOptions } from './types';
import { buildItemtwCharWhitelist, validateAgainstWhitelist, getWhitelistString } from './whitelist';
import { autoCropImage, filterChineseOnly } from './imageUtils';

/**
 * 檢測文字區域
 */
export async function detectTextRegion(image: HTMLImageElement): Promise<{ x: number; y: number; width: number; height: number } | null> {
  try {
    if (typeof window.Tesseract === 'undefined') {
      return null;
    }

    // 使用 Tesseract 原生 CDN 模型；傳入 LSTM 專用 init config 避免「Parameter not found」警告
    const worker = await window.Tesseract.createWorker(OCR_CONFIG.tesseractLang, 1, {}, TESSERACT_INIT_CONFIG);
    
    // OEM 已在 createWorker(lang, 1) 時設為 LSTM，勿在此重設（會觸發「只能於初始化時設定」警告）
    const detectionParams: Record<string, string> = {
      tessedit_pageseg_mode: '7',
    };
    
    if (OCR_CONFIG.useItemtwWhitelist) {
      const whitelist = getWhitelistString();
      if (whitelist) {
        detectionParams.tessedit_char_whitelist = whitelist;
      }
    }
    
    await worker.setParameters(detectionParams);
    const result = await worker.recognize(image);
    await worker.terminate();

    if (!result.data.words || result.data.words.length === 0) {
      return null;
    }

    const validWords = result.data.words.filter((word) => 
      word.bbox && word.text.trim().length > 0
    );
    
    if (validWords.length === 0) {
      return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    const bottomEdges: number[] = [];
    
    validWords.forEach((word) => {
      if (word.bbox) {
        minX = Math.min(minX, word.bbox.x0);
        minY = Math.min(minY, word.bbox.y0);
        maxX = Math.max(maxX, word.bbox.x1);
        bottomEdges.push(word.bbox.y1);
      }
    });
    
    bottomEdges.sort((a, b) => a - b);
    
    const heights = validWords
      .map((word) => word.bbox ? word.bbox.y1 - word.bbox.y0 : 0)
      .filter((h) => h > 0);
    const avgHeight = heights.reduce((sum, h) => sum + h, 0) / heights.length;
    
    const maxBottomEdge = Math.max(...bottomEdges);
    const percentile80Index = Math.floor(bottomEdges.length * 0.8);
    let maxY = bottomEdges[percentile80Index];
    
    if (maxBottomEdge - maxY > avgHeight * 1.5) {
      const percentile75Index = Math.floor(bottomEdges.length * 0.75);
      maxY = bottomEdges[percentile75Index];
      
      if (maxBottomEdge - maxY > avgHeight * 2) {
        const percentile70Index = Math.floor(bottomEdges.length * 0.7);
        maxY = bottomEdges[percentile70Index];
      }
    }
    
    const percentile65Index = Math.floor(bottomEdges.length * 0.65);
    maxY = Math.max(maxY, bottomEdges[percentile65Index]);

    if (minX === Infinity || minY === Infinity || maxX === -Infinity || maxY === -Infinity) {
      return null;
    }

    const textWidth = maxX - minX;
    const textHeight = maxY - minY;
    
    const basePadding = OCR_CONFIG.autoCropPadding;
    const imageArea = image.width * image.height;
    const textArea = textWidth * textHeight;
    const textRatio = textArea / imageArea;
    
    let padding = basePadding;
    if (imageArea < 500000) {
      padding = Math.max(2, basePadding * 0.6);
    } else if (imageArea > 2000000) {
      padding = Math.min(8, basePadding * 1.2);
    } else if (textRatio > 0.3) {
      padding = Math.max(2, basePadding * 0.7);
    }
    
    padding = Math.max(2, Math.min(8, padding));
    
    const x = Math.max(0, Math.floor(minX - padding));
    const y = Math.max(0, Math.floor(minY - padding));
    const width = Math.min(image.width - x, Math.floor(maxX - minX + padding * 2));
    const height = Math.min(image.height - y, Math.floor(maxY - minY + padding * 2));

    if (width <= 0 || height <= 0) {
      return null;
    }

    return { x, y, width, height };
  } catch (error) {
    console.error('[OCR] 檢測文字區域失敗:', error);
    return null;
  }
}

/**
 * 執行 OCR 識別
 */
export async function performOCR(
  image: HTMLImageElement,
  filterOptions?: OCRFilterOptions,
  onProgress?: (p: number) => void
): Promise<string> {
  const effectiveOptions = {
    enableAutoTextDetection: filterOptions?.enableAutoTextDetection ?? OCR_CONFIG.enableAutoTextDetection,
    useItemtwWhitelist: filterOptions?.useItemtwWhitelist ?? OCR_CONFIG.useItemtwWhitelist,
    excludeSymbolsAndNumbers: filterOptions?.excludeSymbolsAndNumbers ?? OCR_CONFIG.excludeSymbolsAndNumbersAtRecognition,
  };

  let finalImage = image;
  if (effectiveOptions.enableAutoTextDetection) {
    const textRegion = await detectTextRegion(image);
    if (textRegion) {
      try {
        finalImage = await autoCropImage(image, textRegion);
        if (onProgress) {
          onProgress(0.2);
        }
      } catch (error) {
        console.warn('[OCR] 自動裁剪失敗，使用原圖:', error);
        finalImage = image;
      }
    }
  }

  try {
    if (typeof window.Tesseract === 'undefined') {
      throw new Error('Tesseract.js 尚未載入，請稍候再試');
    }

    // 使用 Tesseract 原生 CDN 模型；傳入 LSTM 專用 init config 避免「Parameter not found」警告
    const worker = await window.Tesseract.createWorker(OCR_CONFIG.tesseractLang, 1, {}, TESSERACT_INIT_CONFIG);

    let chineseCharWhitelist = '';
    
    if (effectiveOptions.useItemtwWhitelist) {
      chineseCharWhitelist = await buildItemtwCharWhitelist();
    }
    
    // OEM 已在 createWorker(lang, 1) 時設為 LSTM，勿在此重設
    const params = {
      tessedit_char_whitelist: chineseCharWhitelist,
      tessedit_pageseg_mode: '7',
      classify_bln_numeric_mode: '0',
      textord_min_linesize: '2.0', // 降低最小行尺寸，識別更小的字符
      classify_enable_learning: '0',
      tessedit_char_blacklist: '',
      textord_tabvector_vertical_gap_factor: '0.3', // 進一步減少垂直間隙因子
      textord_min_blob_size_fraction: '0.05', // 大幅降低最小blob尺寸分數，識別極細小的筆畫
      textord_excess_blob_size: '2.0', // 大幅增加blob尺寸容忍度，適應高筆畫數繁體字
      textord_really_old_xheight: '0.75', // 大幅降低x高度閾值，識別更小的文字和細筆畫
      classify_adapt_proto_threshold: '0.3', // 進一步降低原型適應閾值，提高對極複雜字符的識別敏感度
      classify_adapt_feature_threshold: '0.3', // 進一步降低特徵適應閾值，提高對極細小筆畫的識別
      textord_min_linesize_fraction: '0.05', // 大幅降低最小行尺寸分數，適應高筆畫數繁體字
      textord_debug_pitch_metric: '0',
      textord_min_blob_size: '1', // 進一步降低最小blob尺寸，識別極細的筆畫
      classify_misfit_junk_penalty: '0.05', // 大幅降低誤識別懲罰，提高對極複雜字符的容忍度
      classify_accept_rating: '0.15', // 進一步降低接受評級閾值，提高識別敏感度
      textord_heavy_nr: '1', // 啟用重行檢測
      textord_really_old_xheight_fraction: '0.7', // 降低x高度分數閾值
      classify_min_norm_scale_x: '0.1', // 降低最小歸一化縮放，識別更小的字符
      classify_max_rating_ratio: '2.0', // 增加最大評級比率，提高對複雜字符的接受度
    };
    
    await worker.setParameters(params);
    const result = await worker.recognize(finalImage);
    
    if (onProgress) {
      onProgress(1.0);
    }

    await worker.terminate();

    let filteredText = result.data.text;
    
    if (result.data.words && result.data.words.length > 0) {
      const sortedWords = [...result.data.words].sort((a, b) => {
        if (Math.abs(a.bbox.y0 - b.bbox.y0) > 5) {
          return a.bbox.y0 - b.bbox.y0;
        }
        return a.bbox.x0 - b.bbox.x0;
      });

      const filteredParts: string[] = [];
      sortedWords.forEach((word) => {
        if (word.confidence >= OCR_CONFIG.minConfidence && word.text.trim().length > 0) {
          filteredParts.push(word.text);
        } else {
          const spaceCount = Math.max(1, Math.ceil(word.text.length));
          filteredParts.push(' '.repeat(spaceCount));
        }
      });

      filteredText = filteredParts.join('');
    }

    const cleanedText = filteredText
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim();

    const processedText = filterChineseOnly(cleanedText);
    
    if (OCR_CONFIG.useItemtwWhitelist) {
      const isValid = validateAgainstWhitelist(processedText);
      if (!isValid) {
        console.warn('[OCR] 識別結果包含不在白名單中的字符');
      }
    }

    return processedText;
  } catch (error) {
    console.error('[OCR] OCR 識別錯誤:', error);
    throw new Error('OCR 辨識過程發生錯誤');
  }
}

/**
 * 處理圖片並執行 OCR
 */
export async function processImageForOCR(
  file: File,
  filterOptions?: OCRFilterOptions,
  onProgress?: (p: number) => void
): Promise<string> {
  try {
    const { loadImage, resizeImageIfNeeded, preprocessImage } = await import('./imageUtils');
    
    const img = await loadImage(file);
    const resizedImage = await resizeImageIfNeeded(img);
    const processedImage = await preprocessImage(resizedImage, filterOptions);
    const recognizedText = await performOCR(processedImage, filterOptions, onProgress);

    return recognizedText.trim();
  } catch (error) {
    console.error('[OCR] 處理圖片失敗:', error);
    throw error;
  }
}
