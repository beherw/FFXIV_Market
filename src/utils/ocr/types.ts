/**
 * OCR 相關類型定義
 */

export interface WhitelistCache {
  charSet: Set<string>;
  bigramSet: Set<string>;
  trigramSet: Set<string>;
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OCRFilterOptions {
  enableAdvancedProcessing?: boolean;
  enableAutoThreshold?: boolean;
  enableAutoTextDetection?: boolean;
  useItemtwWhitelist?: boolean;
  excludeSymbolsAndNumbers?: boolean;
  invertForLightText?: boolean;
}

export interface OCRButtonProps {
  onTextRecognized?: (text: string) => void;
  disabled?: boolean;
}

// Tesseract.js v5 類型聲明
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
        reinitialize?: (langs?: string | string[], oem?: number, config?: string | Record<string, any>) => Promise<void>;
      }>;
    };
  }
}
