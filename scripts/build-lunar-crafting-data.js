#!/usr/bin/env node

/**
 * Build the compact Sinus Ardorum (moon) crafting index used by the simulator.
 *
 * Usage:
 *   node scripts/build-lunar-crafting-data.js \
 *     WKSMissionUnit.csv WKSMissionRecipe.csv Recipe.csv RecipeLevelTable.csv Item.csv
 *
 * The first 360 missions are the eight normal lunar crafting-job blocks. Rows
 * 496-535 are the lunar critical missions that can also contain craft recipes.
 * All six mission grades (D/C/B/A/EX/EX+) are retained.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { encode } from '@msgpack/msgpack';

const [, , unitPath, missionRecipePath, recipePath, recipeLevelPath, itemPath] = process.argv;
if (![unitPath, missionRecipePath, recipePath, recipeLevelPath, itemPath].every(Boolean)) {
  console.error('Usage: node scripts/build-lunar-crafting-data.js WKSMissionUnit.csv WKSMissionRecipe.csv Recipe.csv RecipeLevelTable.csv Item.csv');
  process.exit(1);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      field = '';
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, ''));
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

const readCsv = (filePath) => parseCsv(fs.readFileSync(filePath, 'utf8'));
const toInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const scale = (base, factor) => Math.max(0, Math.floor((toInt(base) * toInt(factor, 100)) / 100));

const units = readCsv(unitPath);
const missionRecipes = readCsv(missionRecipePath);
const recipes = readCsv(recipePath);
const recipeLevels = readCsv(recipeLevelPath);
const items = readCsv(itemPath);

const lunarUnits = units.filter((row) => {
  const missionId = toInt(row['#']);
  const classJobCategory = toInt(row['ClassJobCategory[0]']);
  return ((missionId >= 1 && missionId <= 360) || (missionId >= 496 && missionId <= 535))
    && classJobCategory >= 9
    && classJobCategory <= 16
    && toInt(row.WKSMissionRecipe) > 0;
});

const groupById = new Map(missionRecipes.map((row) => [toInt(row['#']), row]));
const recipeById = new Map(recipes.map((row) => [toInt(row['#']), row]));
const levelById = new Map(recipeLevels.map((row) => [toInt(row['#']), row]));
const itemById = new Map(items.map((row) => [toInt(row['#']), row]));
const recipeRanks = new Map();

for (const unit of lunarUnits) {
  const group = groupById.get(toInt(unit.WKSMissionRecipe));
  if (!group) continue;
  for (let index = 0; index < 5; index += 1) {
    const recipeId = toInt(group[`Recipe[${index}]`]);
    if (!recipeId) continue;
    const ranks = recipeRanks.get(recipeId) || new Set();
    ranks.add(toInt(unit.LevelGroup));
    recipeRanks.set(recipeId, ranks);
  }
}

const packedRecipes = [];
const itemMetadata = new Map();

for (const [recipeId, rankSet] of recipeRanks) {
  const source = recipeById.get(recipeId);
  if (!source) throw new Error(`Missing Recipe row ${recipeId}`);
  const level = levelById.get(toInt(source.RecipeLevelTable));
  if (!level) throw new Error(`Missing RecipeLevelTable row ${source.RecipeLevelTable}`);

  const result = toInt(source.ItemResult);
  const ingredients = [];
  for (let index = 0; index < 8; index += 1) {
    const id = toInt(source[`Ingredient[${index}]`]);
    const amount = toInt(source[`AmountIngredient[${index}]`]);
    if (id > 0 && amount > 0) ingredients.push({ id, amount, quality: null });
  }

  const ranks = Array.from(rankSet).filter((rank) => rank >= 1 && rank <= 6).sort((a, b) => a - b);
  if (!ranks.length) continue;
  packedRecipes.push({
    id: recipeId,
    job: toInt(source.CraftType) + 8,
    lvl: toInt(level.ClassJobLevel),
    yields: toInt(source.AmountResult, 1),
    result,
    stars: toInt(level.Stars),
    qs: source.CanQuickSynth === 'True',
    hq: source.CanHq === 'True',
    durability: scale(level.Durability, source.DurabilityFactor),
    quality: scale(level.Quality, source.QualityFactor),
    progress: scale(level.Difficulty, source.DifficultyFactor),
    suggestedCraftsmanship: toInt(level.SuggestedCraftsmanship),
    controlReq: toInt(source.RequiredControl),
    craftsmanshipReq: toInt(source.RequiredCraftsmanship),
    rlvl: toInt(source.RecipeLevelTable),
    ingredients,
    progressDivider: toInt(level.ProgressDivider, 100),
    qualityDivider: toInt(level.QualityDivider, 100),
    progressModifier: toInt(level.ProgressModifier, 100),
    qualityModifier: toInt(level.QualityModifier, 100),
    expert: source.IsExpert === 'True',
    conditionsFlag: toInt(level.ConditionsFlag, 15),
    cosmicRanks: ranks,
    lunarExploration: true,
  });

  const metadata = itemMetadata.get(result) || {
    id: result,
    name: itemById.get(result)?.Name || `Item ${result}`,
    jobs: new Set(),
    ranks: new Set(),
    ranksByJob: {},
  };
  const job = toInt(source.CraftType) + 8;
  metadata.jobs.add(job);
  ranks.forEach((rank) => metadata.ranks.add(rank));
  const jobRanks = metadata.ranksByJob[job] || new Set();
  ranks.forEach((rank) => jobRanks.add(rank));
  metadata.ranksByJob[job] = jobRanks;
  itemMetadata.set(result, metadata);
}

const output = {
  generatedFrom: 'xivapi/ffxiv-datamining',
  zone: 'Sinus Ardorum',
  recipes: packedRecipes.sort((a, b) => a.id - b.id),
  items: Array.from(itemMetadata.values())
    .map((entry) => ({
      ...entry,
      jobs: Array.from(entry.jobs).sort((a, b) => a - b),
      ranks: Array.from(entry.ranks).sort((a, b) => a - b),
      ranksByJob: Object.fromEntries(Object.entries(entry.ranksByJob).map(([job, ranks]) => [
        job,
        Array.from(ranks).sort((a, b) => a - b),
      ])),
    }))
    .sort((a, b) => a.id - b.id),
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(__dirname, '../public/data/lunar-crafting.msgpack');
fs.writeFileSync(outputPath, encode(output));
console.log(`Wrote ${outputPath}: ${output.recipes.length} recipes, ${output.items.length} items`);
