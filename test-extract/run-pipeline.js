#!/usr/bin/env node
/**
 * TW Data Pipeline — extract CSV data from FFXIV TW client and generate tw-*.json files.
 *
 * Modes:
 *   1. "repo" (default): Use CSVs from ffxiv-datamining-tw repo (pre-extracted)
 *   2. "dumpcsv":        Use pre-existing DumpCSV output from dumpcsv-output/rawexd/
 *   3. "extract":        Run DumpCSV to extract from game client, then generate JSONs
 *   4. "local":          Use CSVs from csv/cht/ (Oxidizer format, auto-converted)
 *
 * Usage (from project root):
 *   node test-extract/run-pipeline.js                       # repo mode
 *   node test-extract/run-pipeline.js --pull                # pull latest from repo first
 *   node test-extract/run-pipeline.js --extract             # extract from game client + generate
 *   node test-extract/run-pipeline.js --dumpcsv             # use existing DumpCSV output
 *   node test-extract/run-pipeline.js --local               # use local csv/cht/ (Oxidizer)
 *   node test-extract/run-pipeline.js --only items,recipes  # generate specific outputs
 *
 * Env vars:
 *   DATAMINING_TW_DIR  — Path to ffxiv-datamining-tw clone
 *                          (default: tw_dataminer/ffxiv-datamining-tw)
 *   GAME_PATH          — FFXIV TW install path
 *                          (default: D:\FINAL FANTASY XIV TC)
 *   DUMPCSV_DIR        — Path to built DumpCSV bin directory
 *                          (default: tw_dataminer/dumpcsv/bin/Release/net8.0)
 *   DUMPCSV_OUTPUT_DIR — DumpCSV rawexd output directory
 *                          (default: tw_dataminer/dumpcsv-output/rawexd)
 *   DOTNET_ROOT        — .NET runtime location (if not in PATH)
 *   SKIP_EXPORT        — Set to "1" to skip JSON generation (only copy CSVs)
 */

const path = require('path');
const fs = require('fs');
const { execSync, spawnSync } = require('child_process');

const TEST_EXTRACT_DIR = path.resolve(__dirname);
const ROOT = path.resolve(__dirname, '..');

/**
 * Find dotnet executable: DOTNET_ROOT, then PATH, then common install paths.
 * Returns { exe, dir } where dir is the folder to prepend to PATH for the child (or null).
 */
function findDotnetExe() {
  const isWin = process.platform === 'win32';
  const name = isWin ? 'dotnet.exe' : 'dotnet';

  // 1. DOTNET_ROOT
  const root = process.env.DOTNET_ROOT;
  if (root) {
    const exe = path.join(root, name);
    if (fs.existsSync(exe)) return { exe, dir: path.dirname(exe) };
  }

  // 2. Already in PATH?
  const r = spawnSync(isWin ? 'dotnet.exe' : 'dotnet', ['--version'], {
    encoding: 'utf8',
    timeout: 5000,
    windowsHide: true
  });
  if (!r.error && r.status === 0) return { exe: isWin ? 'dotnet.exe' : 'dotnet', dir: null };

  // 3. Windows: common install locations
  if (isWin) {
    const programDirs = [
      process.env.ProgramFiles || 'C:\\Program Files',
      process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
    ];
    for (const programDir of programDirs) {
      const exe = path.join(programDir, 'dotnet', name);
      if (fs.existsSync(exe)) return { exe, dir: path.dirname(exe) };
    }
    // 4. Ask shell (where dotnet) in case PATH is set there
    try {
      const out = execSync('where dotnet', { encoding: 'utf8', timeout: 3000, windowsHide: true });
      const first = out.split(/\r?\n/)[0]?.trim();
      if (first && fs.existsSync(first)) return { exe: first, dir: path.dirname(first) };
    } catch (_) {}
  } else {
    try {
      const out = execSync('which dotnet', { encoding: 'utf8', timeout: 3000 });
      const exe = out.split(/\r?\n/)[0]?.trim();
      if (exe && fs.existsSync(exe)) return { exe, dir: path.dirname(exe) };
    } catch (_) {}
  }

  return { exe: name, dir: null };
}
const CSV_CHT_DIR = path.join(TEST_EXTRACT_DIR, 'csv', 'cht');
const LIBRARY_DIR = path.join(TEST_EXTRACT_DIR, 'library');
const OUTPUT_DIR = path.join(TEST_EXTRACT_DIR, 'output');

const DATAMINING_TW_DIR = process.env.DATAMINING_TW_DIR || path.join(ROOT, 'tw_dataminer', 'ffxiv-datamining-tw');
const DUMPCSV_OUTPUT_DIR = process.env.DUMPCSV_OUTPUT_DIR || path.join(ROOT, 'tw_dataminer', 'dumpcsv-output', 'rawexd');
const DUMPCSV_BIN_DIR = process.env.DUMPCSV_DIR || path.join(ROOT, 'tw_dataminer', 'dumpcsv', 'bin', 'Release', 'net8.0');
const GAME_PATH = process.env.GAME_PATH || 'D:\\FINAL FANTASY XIV TC';

// Parse args
const args = process.argv.slice(2);
const useLocal = args.includes('--local');
const useDumpCSV = args.includes('--dumpcsv');
const useExtract = args.includes('--extract');
const doPull = args.includes('--pull');
const skipExport = process.env.SKIP_EXPORT === '1';
const onlyArg = args.find(a => a.startsWith('--only'));
const onlyList = onlyArg ? args[args.indexOf(onlyArg) + 1] : null;

// ─── Helpers ───────────────────────────────────────────────────────────

function parseCSVLine(line) {
  const fields = [];
  let buf = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          buf += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        buf += ch;
      }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ',') {
      fields.push(buf);
      buf = '';
    } else if (ch !== '\r') {
      buf += ch;
    }
  }
  fields.push(buf);
  return fields;
}

function convertOxidizerCSV(content) {
  const lines = content.split(/\r?\n/);
  if (lines.length === 0) return content;
  const fieldLine = lines[0];
  const fields = parseCSVLine(fieldLine);
  const numCols = fields.length;
  const keyRow = ['key'];
  for (let i = 1; i < numCols; i++) keyRow.push(String(i - 1));
  const typeRow = fields.map((_, i) => i === 0 ? 'int32' : 'str');
  return [keyRow.join(','), fieldLine, typeRow.join(','), ...lines.slice(1)].join('\n');
}

function isSaintCoinachFormat(filePath) {
  const firstLine = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/)[0];
  return firstLine.startsWith('key,');
}

// ─── Step 1: Get CSVs into library/ ────────────────────────────────────

function copyFromRepo() {
  const rawexdDir = path.join(DATAMINING_TW_DIR, 'rawexd');

  if (!fs.existsSync(rawexdDir)) {
    console.error('ffxiv-datamining-tw repo not found at:', DATAMINING_TW_DIR);
    console.error('Clone it: git clone --depth 1 https://github.com/harukaxxxx/ffxiv-datamining-tw.git');
    process.exit(1);
  }

  if (doPull) {
    console.log('[Step 1] Pulling latest from ffxiv-datamining-tw...');
    try {
      execSync('git pull', { cwd: DATAMINING_TW_DIR, stdio: 'inherit' });
    } catch (e) {
      console.error('git pull failed:', e.message);
    }
  }

  console.log('[Step 1] Copying CSVs from datamining-tw repo...');
  console.log('  From:', rawexdDir);
  console.log('  To:', LIBRARY_DIR);

  if (!fs.existsSync(LIBRARY_DIR)) fs.mkdirSync(LIBRARY_DIR, { recursive: true });

  let count = 0;
  for (const entry of fs.readdirSync(rawexdDir)) {
    if (!entry.toLowerCase().endsWith('.csv')) continue;
    fs.copyFileSync(path.join(rawexdDir, entry), path.join(LIBRARY_DIR, entry));
    count++;
  }

  console.log(`[Step 1] Done. ${count} CSVs copied to library/.`);
  console.log('');
}

function copyFromLocal() {
  if (!fs.existsSync(CSV_CHT_DIR)) {
    console.error('Local csv/cht/ not found:', CSV_CHT_DIR);
    console.error('Run the Oxidizer first: node test-extract/run-data-miner.js');
    process.exit(1);
  }

  console.log('[Step 1] Converting and copying local CSVs...');
  console.log('  From:', CSV_CHT_DIR);
  console.log('  To:', LIBRARY_DIR);

  if (!fs.existsSync(LIBRARY_DIR)) fs.mkdirSync(LIBRARY_DIR, { recursive: true });

  let count = 0;
  for (const entry of fs.readdirSync(CSV_CHT_DIR)) {
    if (!entry.toLowerCase().endsWith('.csv')) continue;
    const srcPath = path.join(CSV_CHT_DIR, entry);
    if (!fs.statSync(srcPath).isFile()) continue;

    const content = fs.readFileSync(srcPath, 'utf-8');
    // Check if it needs conversion (Oxidizer = 1 header, Saint Coinach = 3 headers)
    const needsConvert = !content.startsWith('key,');
    const output = needsConvert ? convertOxidizerCSV(content) : content;
    fs.writeFileSync(path.join(LIBRARY_DIR, entry), output);
    count++;
  }

  console.log(`[Step 1] Done. ${count} CSVs processed and copied to library/.`);
  console.log('');
}

function extractFromClient() {
  const gameSqpackDir = path.join(GAME_PATH, 'game', 'sqpack');
  const dumpCsvDll = path.join(DUMPCSV_BIN_DIR, 'DumpCsv.dll');
  const outputBaseDir = path.dirname(DUMPCSV_OUTPUT_DIR); // dumpcsv-output/

  if (!fs.existsSync(gameSqpackDir)) {
    console.error('Game sqpack directory not found:', gameSqpackDir);
    console.error('Set GAME_PATH env var to your FFXIV TW install directory.');
    process.exit(1);
  }

  if (!fs.existsSync(dumpCsvDll)) {
    console.error('DumpCSV not built. Expected:', dumpCsvDll);
    console.error('Build it: cd dumpcsv && dotnet build -c Release');
    process.exit(1);
  }

  // Read game version for info
  const gameVerPath = path.join(GAME_PATH, 'game', 'ffxivgame.ver');
  let gameVer = 'unknown';
  if (fs.existsSync(gameVerPath)) {
    gameVer = fs.readFileSync(gameVerPath, 'utf-8').trim();
  }

  console.log('[Step 0] Extracting CSVs from FFXIV TW game client...');
  console.log('  Game path:', GAME_PATH);
  console.log('  Game version:', gameVer);
  console.log('  DumpCSV:', dumpCsvDll);
  console.log('  Output:', outputBaseDir);
  console.log('');

  // Ensure output directory exists
  if (!fs.existsSync(outputBaseDir)) fs.mkdirSync(outputBaseDir, { recursive: true });

  const { exe: dotnetExe, dir: dotnetDir } = findDotnetExe();
  const spawnEnv = { ...process.env };
  if (dotnetDir) {
    spawnEnv.PATH = dotnetDir + path.delimiter + (process.env.PATH || '');
  }

  const cmdArgs = [
    dumpCsvDll,
    GAME_PATH,  // DumpCSV expects game root (e.g. D:\FINAL FANTASY XIV TC), not sqpack
    'cht',
    'rawexd',
    outputBaseDir
  ];

  console.log('  Running:', dotnetExe, cmdArgs.join(' '));
  console.log('');

  try {
    const result = spawnSync(dotnetExe, cmdArgs, {
      stdio: 'inherit',
      timeout: 600000, // 10 minute timeout
      windowsHide: false,
      env: spawnEnv,
      cwd: DUMPCSV_BIN_DIR  // so Saint Coinach finds Definitions\game.ver, SaintCoinach.History.zip, etc.
    });

    if (result.error) {
      if (result.error.code === 'ENOENT') {
        console.error('\nDotnet not found. Either:');
        console.error('  1. Set DOTNET_ROOT to your .NET install (e.g. C:\\Program Files\\dotnet)');
        console.error('  2. Or add dotnet to your PATH');
      } else {
        console.error('Error:', result.error.message);
      }
      process.exit(1);
    }
    if (result.status !== 0) {
      console.error(`\nDumpCSV exited with code ${result.status}`);
      process.exit(1);
    }
  } catch (e) {
    console.error('Failed to run DumpCSV:', e.message);
    process.exit(1);
  }

  // Verify extraction produced files
  if (!fs.existsSync(DUMPCSV_OUTPUT_DIR)) {
    console.error('Extraction completed but output directory not found:', DUMPCSV_OUTPUT_DIR);
    process.exit(1);
  }

  const csvCount = fs.readdirSync(DUMPCSV_OUTPUT_DIR).filter(f => f.endsWith('.csv')).length;
  console.log('');
  console.log(`[Step 0] Extraction done. ${csvCount} CSV files extracted.`);
  console.log('');
}

function copyFromDumpCSV() {
  if (!fs.existsSync(DUMPCSV_OUTPUT_DIR)) {
    console.error('DumpCSV output not found at:', DUMPCSV_OUTPUT_DIR);
    console.error('Run DumpCSV first: dotnet DumpCsv.dll "<game-path>" cht rawexd "<output>"');
    process.exit(1);
  }

  console.log('[Step 1] Copying CSVs from DumpCSV output (latest game data)...');
  console.log('  From:', DUMPCSV_OUTPUT_DIR);
  console.log('  To:', LIBRARY_DIR);

  if (!fs.existsSync(LIBRARY_DIR)) fs.mkdirSync(LIBRARY_DIR, { recursive: true });

  let count = 0;
  for (const entry of fs.readdirSync(DUMPCSV_OUTPUT_DIR)) {
    if (!entry.toLowerCase().endsWith('.csv')) continue;
    const srcPath = path.join(DUMPCSV_OUTPUT_DIR, entry);
    if (!fs.statSync(srcPath).isFile()) continue;
    fs.copyFileSync(srcPath, path.join(LIBRARY_DIR, entry));
    count++;
  }

  console.log(`[Step 1] Done. ${count} CSVs copied to library/.`);
  console.log('');
}

// ─── Step 2: Run exporter ──────────────────────────────────────────────

function runExporter() {
  if (skipExport) {
    console.log('[Step 2] SKIP_EXPORT=1, skipping JSON generation.');
    return;
  }

  console.log('[Step 2] Running TW exporter...');
  console.log('  Output:', OUTPUT_DIR);
  console.log('');

  // Set the filter arg if --only was specified
  if (onlyList) {
    process.argv[2] = onlyList;
  } else {
    process.argv[2] = undefined;
  }

  require('./exporter/index-tw.js');

  const jsonFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.json'));
  console.log('');
  console.log(`[Step 2] Done. ${jsonFiles.length} tw-*.json files in output/.`);
}

// ─── Main ──────────────────────────────────────────────────────────────

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  TW Data Pipeline');
  const mode = useExtract ? 'extract (game client → CSV → JSON)' :
               useDumpCSV ? 'dumpcsv (pre-extracted CSV → JSON)' :
               useLocal   ? 'local (csv/cht/)' :
                            'repo (ffxiv-datamining-tw)';
  console.log('  Mode:', mode);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // --extract: run DumpCSV first, then copy to library
  if (useExtract) {
    extractFromClient();
    copyFromDumpCSV();
  } else if (useDumpCSV) {
    copyFromDumpCSV();
  } else if (useLocal) {
    copyFromLocal();
  } else {
    copyFromRepo();
  }

  runExporter();

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Pipeline complete!');
  console.log('  Library (CSVs): test-extract/library/');
  console.log('  JSON output:    test-extract/output/tw-*.json');
  console.log('═══════════════════════════════════════════════════════════');
}

main();
