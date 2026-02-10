#!/usr/bin/env node
/**
 * Resolve TW JSON sources for deploy/build.
 * For each tw-*.json, compare modify date of:
 *   - teamcraft_git/libs/data/src/lib/json/tw/ (theirs)
 *   - tw_dataminer/output/ (ours)
 * Copy the newer file into .tw-json/ so build and Vite use it.
 * If only one source exists, use that one.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TC_TW_DIR = path.join(ROOT, 'teamcraft_git', 'libs', 'data', 'src', 'lib', 'json', 'tw');
const OUR_OUTPUT_DIR = path.join(ROOT, 'tw_dataminer', 'output');
const RESOLVED_DIR = path.join(ROOT, '.tw-json');

function listTwJsonFiles() {
  const fromTc = fs.existsSync(TC_TW_DIR)
    ? fs.readdirSync(TC_TW_DIR).filter((f) => f.startsWith('tw-') && f.endsWith('.json'))
    : [];
  const fromOurs = fs.existsSync(OUR_OUTPUT_DIR)
    ? fs.readdirSync(OUR_OUTPUT_DIR).filter((f) => f.startsWith('tw-') && f.endsWith('.json'))
    : [];
  const set = new Set([...fromTc, ...fromOurs]);
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
    console.log('[resolve-tw-json] No tw-*.json found in teamcraft or tw_dataminer/output. Using teamcraft path for build.');
    return;
  }

  let usedOurs = 0;
  let usedTheirs = 0;

  for (const name of files) {
    const tcPath = path.join(TC_TW_DIR, name);
    const ourPath = path.join(OUR_OUTPUT_DIR, name);
    const resolvedPath = path.join(RESOLVED_DIR, name);

    const tcMtime = getMtime(tcPath);
    const ourMtime = getMtime(ourPath);

    let sourcePath;
    if (tcMtime && !ourMtime) {
      sourcePath = tcPath;
      usedTheirs++;
    } else if (ourMtime && !tcMtime) {
      sourcePath = ourPath;
      usedOurs++;
    } else if (ourMtime >= tcMtime) {
      sourcePath = ourPath;
      usedOurs++;
    } else {
      sourcePath = tcPath;
      usedTheirs++;
    }

    fs.copyFileSync(sourcePath, resolvedPath);
  }

  console.log(`[resolve-tw-json] Resolved ${files.length} tw-*.json → .tw-json/ (ours: ${usedOurs}, teamcraft: ${usedTheirs})`);
}

main();
