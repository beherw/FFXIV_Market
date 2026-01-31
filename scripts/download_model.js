/**
 * 從 GitHub Releases 下載 gumblex/tessdata_chi 最新模型
 * 
 * 使用方法：
 * npm run download-model
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  langDataDir: path.join(__dirname, '..', 'public', 'tesseract', 'lang-data'),
  modelFilename: 'chi_tra.traineddata',
  versionFile: path.join(__dirname, '..', 'public', 'tesseract', 'lang-data', '.version'),
  // GitHub API 獲取最新 release
  githubApiUrl: 'https://api.github.com/repos/gumblex/tessdata_chi/releases/latest',
};

// 確保目錄存在
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ 創建目錄: ${dir}`);
  }
}

// 讀取已安裝的版本信息
function getInstalledVersion() {
  try {
    if (fs.existsSync(CONFIG.versionFile)) {
      const versionData = fs.readFileSync(CONFIG.versionFile, 'utf-8');
      return JSON.parse(versionData);
    }
  } catch (error) {
    // 忽略錯誤，返回 null
  }
  return null;
}

// 保存版本信息
function saveVersionInfo(releaseTag, modelSize) {
  try {
    const versionData = {
      tag: releaseTag,
      modelSize: modelSize,
      installedAt: new Date().toISOString(),
    };
    fs.writeFileSync(CONFIG.versionFile, JSON.stringify(versionData, null, 2), 'utf-8');
  } catch (error) {
    // 忽略錯誤
  }
}

// 獲取最新 release 信息
function getLatestRelease() {
  return new Promise((resolve, reject) => {
    https.get(CONFIG.githubApiUrl, {
      headers: {
        'User-Agent': 'FFXIV-Market-Downloader',
        'Accept': 'application/vnd.github.v3+json',
      },
    }, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        if (response.statusCode !== 200) {
          reject(new Error(`GitHub API 錯誤: ${response.statusCode} ${response.statusMessage}`));
          return;
        }
        
        try {
          const release = JSON.parse(data);
          resolve(release);
        } catch (error) {
          reject(new Error(`解析 JSON 失敗: ${error.message}`));
        }
      });
    }).on('error', (err) => {
      reject(new Error(`網絡錯誤: ${err.message}`));
    });
  });
}

// 下載文件
function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const filename = path.basename(filepath);
    
    console.log(`正在下載: ${filename}...`);
    console.log(`  URL: ${url}`);
    
    const file = fs.createWriteStream(filepath);
    
    const request = protocol.get(url, {
      headers: {
        'User-Agent': 'FFXIV-Market-Downloader',
      },
    }, (response) => {
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
    
    request.setTimeout(120000, () => {
      request.destroy();
      file.close();
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      reject(new Error(`下載超時 (120秒)\n  URL: ${url}`));
    });
  });
}

// 主函數
async function main() {
  // 確保目錄存在
  ensureDir(CONFIG.langDataDir);
  
  // 先檢查已安裝的版本，避免不必要的 API 調用
  const installedVersion = getInstalledVersion();
  const modelPath = path.join(CONFIG.langDataDir, CONFIG.modelFilename);
  const localFileExists = fs.existsSync(modelPath);
  
  // 如果版本文件存在且檔案存在，先快速檢查是否需要更新
  if (installedVersion && localFileExists) {
    const stats = fs.statSync(modelPath);
    // 如果檔案大小與記錄的版本大小相符，假設版本正確，快速退出
    if (installedVersion.modelSize && stats.size === installedVersion.modelSize) {
      // 只有在需要檢查更新時才調用 API（例如 CI/CD 環境）
      // 本地開發時，如果版本文件存在且檔案大小相符，直接跳過
      const shouldCheckUpdate = process.env.CHECK_MODEL_UPDATE === 'true';
      
      if (!shouldCheckUpdate) {
        // 快速退出，不調用 GitHub API
        return;
      }
    }
  }
  
  console.log('正在獲取 gumblex/tessdata_chi 最新版本信息...\n');
  
  try {
    // 獲取最新 release
    const release = await getLatestRelease();
    console.log(`✓ 找到最新版本: ${release.tag_name}`);
    console.log(`  發布時間: ${release.published_at}`);
    console.log(`  發布說明: ${release.name || release.tag_name}\n`);
    
    // 查找 chi_tra.traineddata 文件或包含它的 zip 文件
    let asset = release.assets.find((asset) => 
      asset.name === CONFIG.modelFilename || 
      (asset.name.includes('chi_tra') && asset.name.endsWith('.traineddata'))
    );
    
    // 如果沒找到單獨的 .traineddata 文件，查找 zip 文件
    let zipAsset = null;
    if (!asset) {
      zipAsset = release.assets.find((asset) => 
        asset.name.includes('chi') && (asset.name.endsWith('.zip') || asset.name.endsWith('.tar.gz'))
      );
      
      if (zipAsset) {
        console.log(`找到壓縮包: ${zipAsset.name} (${(zipAsset.size / 1024 / 1024).toFixed(2)} MB)`);
        console.log('將下載並解壓縮...\n');
      }
    }
    
    if (!asset && !zipAsset) {
      console.error('✗ 未找到 chi_tra.traineddata 文件或包含它的壓縮包');
      console.log('\n可用的文件：');
      release.assets.forEach((a) => {
        console.log(`  - ${a.name} (${(a.size / 1024 / 1024).toFixed(2)} MB)`);
      });
      console.log('\n請手動下載並解壓，將 chi_tra.traineddata 放置到:', CONFIG.langDataDir);
      process.exit(1);
    }
    
    // 檢查已安裝的版本
    if (installedVersion) {
      console.log(`已安裝版本: ${installedVersion.tag}`);
      console.log(`  安裝時間: ${installedVersion.installedAt}`);
      console.log(`  模型大小: ${installedVersion.modelSize ? (installedVersion.modelSize / 1024 / 1024).toFixed(2) + ' MB' : '未知'}`);
      
      // 如果版本標籤相同，跳過下載
      if (installedVersion.tag === release.tag_name) {
        console.log(`\n✓ 已安裝版本與最新版本相同 (${release.tag_name})，跳過下載`);
        return;
      } else {
        console.log(`\n⚠  發現新版本 (${installedVersion.tag} → ${release.tag_name})，將更新...`);
      }
    } else if (localFileExists) {
      // 如果版本文件不存在，但本地文件存在，嘗試推斷版本
      const stats = fs.statSync(modelPath);
      const localFileSize = stats.size;
      const localFileTime = stats.mtime;
      const releaseDate = new Date(release.published_at);
      
      console.log(`\n檢查本地模型文件（版本文件不存在）...`);
      console.log(`  文件大小: ${(localFileSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  修改時間: ${localFileTime.toISOString()}`);
      console.log(`  最新版本: ${release.tag_name} (${release.published_at})`);
      
      // 如果本地文件大小合理（> 50 MB 且 < 100 MB），且修改時間晚於或接近 release 時間
      // 假設可能是最新版本，創建版本文件並跳過下載
      if (localFileSize > 50 * 1024 * 1024 && localFileSize < 100 * 1024 * 1024) {
        // 允許 1 天的時間差（考慮時區和文件系統時間誤差）
        const timeDiff = localFileTime.getTime() - releaseDate.getTime();
        const oneDay = 24 * 60 * 60 * 1000;
        
        if (timeDiff >= -oneDay) {
          console.log('\n✓ 本地模型文件可能是最新版本，創建版本文件並跳過下載');
          saveVersionInfo(release.tag_name, localFileSize);
          console.log(`  已創建版本文件: ${CONFIG.versionFile}`);
          return;
        }
      }
      
      console.log('\n⚠  無法確定本地文件版本，將檢查最新版本...');
    }
    
    // 如果找到單獨的 .traineddata 文件
    if (asset) {
      console.log(`找到模型文件: ${asset.name} (${(asset.size / 1024 / 1024).toFixed(2)} MB)`);
      
      // 檢查文件是否已存在且大小相同（表示已是最新版本）
      if (fs.existsSync(modelPath)) {
        const stats = fs.statSync(modelPath);
        if (stats.size === asset.size && (!installedVersion || installedVersion.tag === release.tag_name)) {
          console.log('\n✓ 模型文件已是最新版本，跳過下載');
          console.log(`  本地版本大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
          console.log(`  最新版本大小: ${(asset.size / 1024 / 1024).toFixed(2)} MB`);
          // 更新版本信息
          saveVersionInfo(release.tag_name, asset.size);
          return;
        } else {
          console.log('\n⚠  發現版本差異，將更新...');
          console.log(`  本地版本大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
          console.log(`  最新版本大小: ${(asset.size / 1024 / 1024).toFixed(2)} MB`);
          fs.unlinkSync(modelPath);
        }
      }
      
      // 下載文件
      await downloadFile(asset.browser_download_url, modelPath);
      
      // 保存版本信息
      saveVersionInfo(release.tag_name, asset.size);
      
      console.log('\n✓ gumblex/tessdata_chi 模型下載完成！');
      console.log(`  文件位置: ${modelPath}`);
      console.log(`  版本: ${release.tag_name}`);
      console.log('\nOCR 功能現在可以使用優化的繁體中文模型了！');
      return;
    }
    
    // 如果找到 zip 文件，需要下載並解壓
    if (zipAsset) {
      // 如果已安裝版本與最新版本相同，跳過下載
      if (installedVersion && installedVersion.tag === release.tag_name) {
        console.log(`\n✓ 已安裝版本與最新版本相同 (${release.tag_name})，跳過下載`);
        console.log(`  如需強制更新，請刪除 ${CONFIG.versionFile} 後重新構建`);
        return;
      }
      
      // 檢查本地模型文件是否已存在
      if (fs.existsSync(modelPath)) {
        const stats = fs.statSync(modelPath);
        const localFileSize = stats.size;
        const localFileTime = stats.mtime;
        const releaseDate = new Date(release.published_at);
        
        console.log(`\n檢查本地模型文件...`);
        console.log(`  文件大小: ${(localFileSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  修改時間: ${localFileTime.toISOString()}`);
        console.log(`  最新版本: ${release.tag_name} (${release.published_at})`);
        
        // 如果版本文件不存在，但本地文件存在且修改時間晚於 release 時間
        // 且文件大小合理（> 50 MB 且 < 100 MB），假設可能是最新版本
        if (!installedVersion) {
          if (localFileSize > 50 * 1024 * 1024 && localFileSize < 100 * 1024 * 1024) {
            if (localFileTime >= releaseDate) {
              console.log('\n✓ 本地模型文件可能是最新版本，跳過下載');
              console.log('  創建版本文件記錄...');
              // 創建版本文件，避免下次再次檢查
              saveVersionInfo(release.tag_name, localFileSize);
              return;
            }
          }
        }
        
        console.log('\n⚠  將檢查並更新到最新版本...');
      }
      
      const tempDir = path.join(__dirname, '..', 'temp_tesseract');
      const zipPath = path.join(tempDir, zipAsset.name);
      
      // 創建臨時目錄
      ensureDir(tempDir);
      
      // 下載 zip 文件
      console.log('正在下載壓縮包...');
      await downloadFile(zipAsset.browser_download_url, zipPath);
      
      // 解壓 zip 文件
      console.log('\n正在解壓縮...');
      try {
        // 嘗試使用系統命令解壓（Windows 使用 PowerShell，Linux/Mac 使用 unzip）
        const isWindows = process.platform === 'win32';
        const extractCommand = isWindows
          ? `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempDir}' -Force"`
          : `unzip -o '${zipPath}' -d '${tempDir}'`;
        
        execSync(extractCommand, { stdio: 'inherit' });
        
        // 查找解壓後的 chi_tra.traineddata 文件
        const findModelFile = (dir) => {
          const files = fs.readdirSync(dir, { withFileTypes: true });
          for (const file of files) {
            const fullPath = path.join(dir, file.name);
            if (file.isDirectory()) {
              const found = findModelFile(fullPath);
              if (found) return found;
            } else if (file.name === CONFIG.modelFilename) {
              return fullPath;
            }
          }
          return null;
        };
        
        const extractedModelPath = findModelFile(tempDir);
        
        if (!extractedModelPath) {
          throw new Error('解壓後未找到 chi_tra.traineddata 文件');
        }
        
        // 檢查解壓後的模型文件大小
        const extractedStats = fs.statSync(extractedModelPath);
        const extractedSize = extractedStats.size;
        
        // 如果本地文件已存在且大小相同，跳過複製（避免不必要的更新）
        if (fs.existsSync(modelPath)) {
          const localStats = fs.statSync(modelPath);
          if (localStats.size === extractedSize) {
            console.log(`\n✓ 解壓後的模型文件與本地文件大小相同，跳過更新`);
            console.log(`  文件大小: ${(extractedSize / 1024 / 1024).toFixed(2)} MB`);
            
            // 更新版本信息（確保版本文件是最新的）
            saveVersionInfo(release.tag_name, extractedSize);
            
            // 清理臨時文件
            console.log('\n正在清理臨時文件...');
            fs.rmSync(tempDir, { recursive: true, force: true });
            
            console.log('\n✓ 模型文件已是最新版本，無需更新');
            return;
          } else {
            console.log(`\n⚠  文件大小不同，將更新...`);
            console.log(`  本地文件大小: ${(localStats.size / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  解壓文件大小: ${(extractedSize / 1024 / 1024).toFixed(2)} MB`);
          }
        }
        
        // 複製到目標位置
        console.log(`找到模型文件: ${extractedModelPath}`);
        console.log(`  文件大小: ${(extractedSize / 1024 / 1024).toFixed(2)} MB`);
        fs.copyFileSync(extractedModelPath, modelPath);
        console.log(`✓ 已複製到: ${modelPath}`);
        
        // 保存版本信息
        saveVersionInfo(release.tag_name, extractedSize);
        
        // 清理臨時文件
        console.log('\n正在清理臨時文件...');
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        console.log('\n✓ gumblex/tessdata_chi 模型下載並解壓完成！');
        console.log(`  文件位置: ${modelPath}`);
        console.log(`  版本: ${release.tag_name}`);
        console.log('\nOCR 功能現在可以使用優化的繁體中文模型了！');
        
      } catch (error) {
        // 清理臨時文件
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
        
        console.error('\n✗ 解壓失敗:', error.message);
        console.log('\n請手動操作：');
        console.log(`1. 下載文件: ${zipAsset.browser_download_url}`);
        console.log(`2. 解壓縮 ${zipAsset.name}`);
        console.log(`3. 找到 chi_tra.traineddata 文件`);
        console.log(`4. 複製到: ${CONFIG.langDataDir}`);
        process.exit(1);
      }
    }
    
  } catch (error) {
    console.error('\n✗ 下載失敗:', error.message);
    console.log('\n備用方案：');
    console.log('1. 訪問 https://github.com/gumblex/tessdata_chi/releases');
    console.log('2. 下載最新版本的 chi_tra.traineddata 文件');
    console.log(`3. 將文件放到: ${CONFIG.langDataDir}`);
    process.exit(1);
  }
}

// 運行
main().catch((error) => {
  console.error('執行失敗:', error);
  process.exit(1);
});

export { downloadFile, ensureDir };
