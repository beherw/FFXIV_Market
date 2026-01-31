/**
 * 下載 Tesseract.js 核心文件和 gumblex/tessdata_chi 模型的輔助腳本
 * 
 * 使用方法：
 * 1. 確保已安裝 Node.js 和 npm
 * 2. 運行：npm run download-tesseract
 * 
 * 注意：此腳本會下載 Tesseract.js 核心文件，但需要手動下載 gumblex/tessdata_chi 模型
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

// ES module 中獲取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
// 使用与 index.html 中 CDN 相同的版本，确保兼容性
// index.html 使用: https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js
const TESSERACT_CORE_VERSION = '5.1.0'; // tesseract.js-core 版本（需要匹配 tesseract.js 5.x）
const TESSERACT_JS_VERSION = '5.0.4'; // tesseract.js 版本（与 index.html 中的版本匹配）

const CONFIG = {
  outputDir: path.join(__dirname, '..', 'public', 'tesseract'),
  langDataDir: path.join(__dirname, '..', 'public', 'tesseract', 'lang-data'),
  tesseractVersion: TESSERACT_JS_VERSION,
  files: {
    coreWasmJs: {
      url: `https://cdn.jsdelivr.net/npm/tesseract.js-core@${TESSERACT_CORE_VERSION}/tesseract-core.wasm.js`,
      filename: 'tesseract-core.wasm.js',
    },
    coreWasm: {
      url: `https://cdn.jsdelivr.net/npm/tesseract.js-core@${TESSERACT_CORE_VERSION}/tesseract-core.wasm`,
      filename: 'tesseract-core.wasm',
    },
    worker: {
      url: `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_JS_VERSION}/dist/worker.min.js`,
      filename: 'worker.min.js',
    },
  },
};

// 確保目錄存在
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ 創建目錄: ${dir}`);
  }
}

// 下載文件
function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const filename = path.basename(filepath);
    
    console.log(`正在下載: ${filename}...`);
    console.log(`  URL: ${url}`);
    
    const file = fs.createWriteStream(filepath);
    
    const request = protocol.get(url, (response) => {
      // 處理重定向
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
        const redirectUrl = response.headers.location;
        console.log(`  重定向到: ${redirectUrl}`);
        return downloadFile(redirectUrl, filepath)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
        reject(new Error(`下載失敗: HTTP ${response.statusCode} ${response.statusMessage}\n  URL: ${url}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize) {
          const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
          process.stdout.write(`\r  進度: ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(2)} MB / ${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        const stats = fs.statSync(filepath);
        console.log(`\n✓ 下載完成: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        resolve();
      });
    });
    
    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      reject(new Error(`網絡錯誤: ${err.message}\n  URL: ${url}`));
    });
    
    request.setTimeout(60000, () => {
      request.destroy();
      file.close();
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      reject(new Error(`下載超時 (60秒)\n  URL: ${url}`));
    });
  });
}

// 主函數
async function main() {
  console.log('開始下載 Tesseract.js 核心文件...\n');
  
  // 確保目錄存在
  ensureDir(CONFIG.outputDir);
  ensureDir(CONFIG.langDataDir);
  
  // 下載文件
  try {
    for (const [key, fileInfo] of Object.entries(CONFIG.files)) {
      const filepath = path.join(CONFIG.outputDir, fileInfo.filename);
      
      // 如果文件已存在，跳過
      if (fs.existsSync(filepath)) {
        console.log(`⏭  文件已存在，跳過: ${fileInfo.filename}`);
        continue;
      }
      
      await downloadFile(fileInfo.url, filepath);
    }
    
    console.log('\n✓ 所有 Tesseract.js 核心文件下載完成！');
    
    // 嘗試下載 gumblex/tessdata_chi 模型
    console.log('\n正在嘗試下載 gumblex/tessdata_chi 模型...');
    const modelPath = path.join(CONFIG.langDataDir, 'chi_tra.traineddata');
    
    if (fs.existsSync(modelPath)) {
      console.log('⏭  模型文件已存在，跳過下載');
    } else {
      try {
        // 從 GitHub Releases 下載最新版本
        // 注意：這需要知道確切的 Release 版本號，我們使用 latest 標籤
        const modelUrl = 'https://github.com/gumblex/tessdata_chi/releases/download/latest/chi_tra.traineddata';
        console.log('正在從 GitHub Releases 下載 chi_tra.traineddata...');
        console.log(`  URL: ${modelUrl}`);
        
        await downloadFile(modelUrl, modelPath);
        console.log('✓ gumblex/tessdata_chi 模型下載完成！');
      } catch (error) {
        console.warn('\n⚠  自動下載模型失敗:', error.message);
        console.log('\n請手動下載模型：');
        console.log('1. 訪問 https://github.com/gumblex/tessdata_chi/releases');
        console.log('2. 下載最新版本的 chi_tra.traineddata 文件');
        console.log(`3. 將文件放到: ${CONFIG.langDataDir}`);
        console.log('\n或者運行: npm run download-model');
      }
    }
    
    console.log('\n✓ 所有文件準備完成！');
    console.log('OCR 功能將使用 gumblex/tessdata_chi 優化模型。');
    
  } catch (error) {
    console.error('\n✗ 下載失敗:', error.message);
    process.exit(1);
  }
}

// 運行
main().catch((error) => {
  console.error('執行失敗:', error);
  process.exit(1);
});

export { downloadFile, ensureDir };
