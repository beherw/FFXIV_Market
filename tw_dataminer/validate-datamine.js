#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const repoRoot = path.resolve(__dirname, '..')
const rawPrefix = 'tw_dataminer/dumpcsv-output/rawexd/'
const outputPrefix = 'tw_dataminer/output/'
const baseline = process.env.DATAMINE_BASE || 'HEAD'
const failures = []

function git(args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024
  }).trim()
}

function dataSize(value) {
  if (Array.isArray(value)) return value.length
  if (value && typeof value === 'object') return Object.keys(value).length
  return 0
}

const trackedRawFiles = git(['ls-tree', '-r', '--name-only', baseline, '--', rawPrefix])
  .split(/\r?\n/)
  .filter(Boolean)
const missingRawFiles = trackedRawFiles.filter(file => !fs.existsSync(path.join(repoRoot, file)))
const missingLimit = Math.max(25, Math.ceil(trackedRawFiles.length * 0.02))

if (missingRawFiles.length > missingLimit) {
  failures.push(
    `${missingRawFiles.length} previously tracked raw CSV files disappeared ` +
    `(safety limit: ${missingLimit}).`
  )
}

const currentOutputDir = path.join(repoRoot, outputPrefix)
const currentJsonFiles = fs.existsSync(currentOutputDir)
  ? fs.readdirSync(currentOutputDir).filter(file => /^tw-.*\.json$/i.test(file))
  : []
const baselineJsonFiles = git(['ls-tree', '-r', '--name-only', baseline, '--', outputPrefix])
  .split(/\r?\n/)
  .filter(file => /^tw_dataminer\/output\/tw-.*\.json$/i.test(file))

if (currentJsonFiles.length < 40) {
  failures.push(`Only ${currentJsonFiles.length} tw-*.json output files were produced.`)
}

for (const relativePath of baselineJsonFiles) {
  const file = path.basename(relativePath)
  const currentPath = path.join(repoRoot, relativePath)

  if (!fs.existsSync(currentPath)) {
    failures.push(`${file} disappeared from the generated output.`)
    continue
  }

  try {
    const previousText = git(['show', `${baseline}:${relativePath}`])
    const previousSize = dataSize(JSON.parse(previousText))
    const currentSize = dataSize(JSON.parse(fs.readFileSync(currentPath, 'utf8')))

    if (previousSize >= 100 && currentSize < previousSize * 0.8) {
      failures.push(
        `${file} shrank from ${previousSize} records to ${currentSize} ` +
        '(more than the allowed 20%).'
      )
    }
  } catch (error) {
    failures.push(`${file} is not valid JSON: ${error.message}`)
  }
}

for (const file of currentJsonFiles) {
  if (baselineJsonFiles.includes(`${outputPrefix}${file}`)) continue
  try {
    JSON.parse(fs.readFileSync(path.join(currentOutputDir, file), 'utf8'))
  } catch (error) {
    failures.push(`${file} is not valid JSON: ${error.message}`)
  }
}

if (failures.length > 0) {
  console.error('')
  console.error('DATAMINE SAFETY CHECK FAILED')
  for (const failure of failures) console.error(`  - ${failure}`)
  console.error('')
  console.error('Nothing should be committed or pushed. The launcher will restore origin/main.')
  process.exit(1)
}

console.log(
  `Datamine safety check passed: ${trackedRawFiles.length - missingRawFiles.length} raw CSVs present, ` +
  `${currentJsonFiles.length} JSON outputs checked.`
)
