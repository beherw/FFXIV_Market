/**
 * OCR 白名單管理
 */

import { getTwItems } from '../../services/supabaseData';
import { OCR_CONFIG } from './config';
import type { WhitelistCache } from './types';

let itemtwCharWhitelist: string | null = null;
let whitelistBuildPromise: Promise<string> | null = null;
let itemtwWhitelistCache: WhitelistCache | null = null;

/**
 * 構建 itemtw 字符白名單
 */
export async function buildItemtwCharWhitelist(): Promise<string> {
  if (itemtwCharWhitelist !== null) {
    return itemtwCharWhitelist;
  }

  if (whitelistBuildPromise !== null) {
    return whitelistBuildPromise;
  }

  whitelistBuildPromise = (async () => {
    try {
      const twItemsData = await getTwItems();
      
      const charSet = new Set<string>();
      const bigramSet = new Set<string>();
      const trigramSet = new Set<string>();
      
      Object.values(twItemsData).forEach((item: any) => {
        if (item && item.tw && typeof item.tw === 'string') {
          const name = item.tw.trim();
          if (!name) return;
          
          // 提取字符
          for (const char of name) {
            const codePoint = char.codePointAt(0);
            if (codePoint !== undefined) {
              if (
                (codePoint >= 0x3400 && codePoint <= 0x4DBF) ||
                (codePoint >= 0x4E00 && codePoint <= 0x9FFF)
              ) {
                charSet.add(char);
              }
            }
          }
          
          // 提取 bigram
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
          
          // 提取 trigram
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

      const sortedChars = Array.from(charSet).sort();
      itemtwCharWhitelist = sortedChars.join('');
      
      itemtwWhitelistCache = {
        charSet,
        bigramSet,
        trigramSet,
      };

      return itemtwCharWhitelist;
    } catch (error) {
      console.error('[OCR] 構建白名單失敗:', error);
      whitelistBuildPromise = null;
      return '';
    }
  })();

  return whitelistBuildPromise;
}

/**
 * 驗證 OCR 識別結果是否符合白名單
 */
export function validateAgainstWhitelist(text: string): boolean {
  if (!OCR_CONFIG.useItemtwWhitelist || !itemtwWhitelistCache) {
    return true;
  }
  
  const { charSet } = itemtwWhitelistCache;
  
  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (codePoint !== undefined) {
      if (
        (codePoint >= 0x3400 && codePoint <= 0x4DBF) || 
        (codePoint >= 0x4E00 && codePoint <= 0x9FFF)
      ) {
        if (!charSet.has(char)) {
          return false;
        }
      }
    }
  }
  
  return true;
}

/**
 * 獲取當前白名單字符串
 */
export function getWhitelistString(): string | null {
  return itemtwCharWhitelist;
}
