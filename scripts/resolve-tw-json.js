#!/usr/bin/env node
/**
 * Resolve TW JSON sources for deploy/build.
 * For each tw-*.json, use first available in order:
 *   1. tw_dataminer/output/   — production pipeline (run tw_dataminer/run-pipeline.js --extract)
 *   2. test-extract/output/   — legacy extractor (run test-extract/run-pipeline.js --extract)
 *   3. teamcraft_git/.../tw/  — upstream Teamcraft data
 * Copies the chosen file into .tw-json/ so build and Vite use it.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TC_TW_DIR = path.join(ROOT, 'teamcraft_git', 'libs', 'data', 'src', 'lib', 'json', 'tw');
const TW_DATAMINER_OUTPUT = path.join(ROOT, 'tw_dataminer', 'output');
const TEST_EXTRACT_OUTPUT = path.join(ROOT, 'test-extract', 'output');
const RESOLVED_DIR = path.join(ROOT, '.tw-json');

function listTwJsonFiles() {
  const fromTc = fs.existsSync(TC_TW_DIR)
    ? fs.readdirSync(TC_TW_DIR).filter((f) => f.startsWith('tw-') && f.endsWith('.json'))
    : [];
  const fromOurs = fs.existsSync(TW_DATAMINER_OUTPUT)
    ? fs.readdirSync(TW_DATAMINER_OUTPUT).filter((f) => f.startsWith('tw-') && f.endsWith('.json'))
    : [];
  const fromTest = fs.existsSync(TEST_EXTRACT_OUTPUT)
    ? fs.readdirSync(TEST_EXTRACT_OUTPUT).filter((f) => f.startsWith('tw-') && f.endsWith('.json'))
    : [];
  const set = new Set([...fromTc, ...fromOurs, ...fromTest]);
  return [...set].sort();
}

function getMtime(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function main() {
  if (!fs.existsSync(RESOLVED_DIR)) {
    fs.mkdirSync(RESOLVED_DIR, { recursive: true });
  }

  const files = listTwJsonFiles();
  if (files.length === 0) {
    console.log('[resolve-tw-json] No tw-*.json found. Using teamcraft path for build.');
    return;
  }

  let fromTwDataminer = 0;
  let fromTestExtract = 0;
  let fromTeamcraft = 0;

  for (const name of files) {
    const twPath = path.join(TW_DATAMINER_OUTPUT, name);
    const testPath = path.join(TEST_EXTRACT_OUTPUT, name);
    const tcPath = path.join(TC_TW_DIR, name);
    const resolvedPath = path.join(RESOLVED_DIR, name);

    let sourcePath;
    if (getMtime(twPath)) {
      sourcePath = twPath;
      fromTwDataminer++;
    } else if (getMtime(testPath)) {
      sourcePath = testPath;
      fromTestExtract++;
    } else if (getMtime(tcPath)) {
      sourcePath = tcPath;
      fromTeamcraft++;
    } else {
      continue;
    }

    fs.copyFileSync(sourcePath, resolvedPath);
  }

  console.log(`[resolve-tw-json] Resolved ${files.length} tw-*.json → .tw-json/ (tw_dataminer: ${fromTwDataminer}, test-extract: ${fromTestExtract}, teamcraft: ${fromTeamcraft})`);
}

main();
