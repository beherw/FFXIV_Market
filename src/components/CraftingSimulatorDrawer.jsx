import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ItemImage from './ItemImage';
import { findRecipesByResult } from '../services/recipeDatabase';
import { getItemById } from '../services/itemDatabase';
import {
  convertRecipeToSimulatorRecipe,
  createCraftingStatus,
  getAllowedActions,
  getCraftPointsList,
  getDefaultCrafterAttributes,
  runAutoCraftSimulation,
  simulateCrafting,
  simulateCraftingOneStep,
} from '../services/craftingSolver';
import { getCraftingActionIconUrl } from '../utils/craftingActionIcons';
import { generateItemUrl } from '../utils/urlSlug';

const JOB_NAMES = {
  8: '刻木匠',
  9: '鍛鐵匠',
  10: '鑄甲匠',
  11: '雕金匠',
  12: '製革匠',
  13: '裁縫匠',
  14: '煉金術士',
  15: '烹調師',
};

const JOB_ICON_MAP = {
  8: 'https://xivapi.com/i/062000/062008.png',
  9: 'https://xivapi.com/i/062000/062009.png',
  10: 'https://xivapi.com/i/062000/062010.png',
  11: 'https://xivapi.com/i/062000/062011.png',
  12: 'https://xivapi.com/i/062000/062012.png',
  13: 'https://xivapi.com/i/062000/062013.png',
  14: 'https://xivapi.com/i/062000/062014.png',
  15: 'https://xivapi.com/i/062000/062015.png',
};

const ACTION_NAMES = {
  basic_synthesis: '製作',
  basic_touch: '加工',
  masters_mend: '精修',
  hasty_touch: '倉促加工',
  rapid_synthesis: '高速製作',
  observe: '觀察',
  tricks_of_the_trade: '秘訣',
  waste_not: '儉約',
  veneration: '崇敬',
  standard_touch: '中級加工',
  great_strides: '闊步',
  innovation: '改革',
  final_appraisal: '最終確認',
  waste_not_ii: '長期儉約',
  byregots_blessing: '比爾格的祝福',
  byregot_s_blessing: '比爾格的祝福',
  precise_touch: '集中加工',
  muscle_memory: '堅信',
  careful_synthesis: '模範製作',
  manipulation: '掌握',
  prudent_touch: '儉約加工',
  reflect: '閒靜',
  preparatory_touch: '坯料加工',
  groundwork: '坯料製作',
  delicate_synthesis: '精密製作',
  intensive_synthesis: '集中製作',
  trained_eye: '工匠的神速技巧',
  advanced_touch: '上級加工',
  prudent_synthesis: '儉約製作',
  trained_finesse: '工匠的神技',
  careful_observation: '設計變動',
  heart_and_soul: '專心致志',
  refined_touch: '精修加工',
  daring_touch: '大膽加工',
  immaculate_mend: '巧奪天工',
  quick_innovation: '快速改革',
  trained_perfection: '工匠的絕技',
  rapid_synthesis_fail: '高速製作（失敗）',
  hasty_touch_fail: '倉促加工（失敗）',
  daring_touch_fail: '大膽加工（失敗）',
};

// Required crafter level for each manual action (FFXIV Dawntrail 7.x)
const ACTION_LEVEL_REQUIREMENTS = {
  basic_synthesis: 1,
  basic_touch: 5,
  masters_mend: 7,
  hasty_touch: 9,
  rapid_synthesis: 9,
  observe: 13,
  tricks_of_the_trade: 13,
  waste_not: 15,
  veneration: 15,
  standard_touch: 18,
  great_strides: 21,
  innovation: 26,
  final_appraisal: 42,
  waste_not_ii: 47,
  byregots_blessing: 50,
  byregot_s_blessing: 50,
  precise_touch: 53,
  muscle_memory: 54,
  careful_observation: 55,
  careful_synthesis: 62,
  manipulation: 65,
  prudent_touch: 66,
  reflect: 69,
  preparatory_touch: 71,
  groundwork: 72,
  delicate_synthesis: 76,
  intensive_synthesis: 78,
  trained_eye: 80,
  advanced_touch: 84,
  heart_and_soul: 86,
  prudent_synthesis: 88,
  trained_finesse: 90,
  refined_touch: 92,
  quick_innovation: 96,
  daring_touch: 96,
  immaculate_mend: 98,
  trained_perfection: 100,
};

const UNSIMULATABLE_ACTIONS = ['intensive_synthesis', 'precise_touch'];

const CONDITION_NAMES = {
  Normal: '通常',
  Good: '高品質',
  Excellent: '最高品質',
  Poor: '低品質',
  Centered: '安定',
  Sturdy: '結實',
  Pliant: '高效',
  Malleable: '大進展',
  Primed: '長持續',
  GoodOmen: '良兆',
};

const CONDITION_BADGE_CLASSES = {
  Normal: 'border-slate-600/60 bg-slate-800/60 text-slate-200',
  Good: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  Excellent: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  Poor: 'border-slate-700/60 bg-slate-900/90 text-slate-400',
  Centered: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  Sturdy: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  Pliant: 'border-green-500/30 bg-green-500/10 text-green-300',
  Malleable: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  Primed: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  GoodOmen: 'border-pink-500/30 bg-pink-500/10 text-pink-300',
};

const MANUAL_ACTION_CATEGORIES = {
  opening: ['reflect', 'muscle_memory', 'trained_eye'],
  durability: ['masters_mend', 'immaculate_mend', 'manipulation', 'waste_not', 'waste_not_ii', 'trained_perfection'],
  synthesis: ['basic_synthesis', 'careful_synthesis', 'rapid_synthesis', 'groundwork', 'prudent_synthesis', 'intensive_synthesis', 'delicate_synthesis', 'veneration', 'final_appraisal'],
  touch: ['basic_touch', 'hasty_touch', 'standard_touch', 'advanced_touch', 'prudent_touch', 'preparatory_touch', 'precise_touch', 'refined_touch', 'daring_touch', 'trained_finesse', 'great_strides', 'innovation', 'quick_innovation', 'byregots_blessing'],
  condition: ['tricks_of_the_trade', 'heart_and_soul', 'careful_observation'],
  utility: ['observe'],
};

const MANUAL_CATEGORY_NAMES = {
  opening: '起手',
  durability: '耐久',
  synthesis: '作業',
  touch: '加工',
  condition: '狀態',
  utility: '其他',
};

const ALL_MANUAL_ACTIONS = Object.values(MANUAL_ACTION_CATEGORIES).flat();

const CRAFTER_STATS_CACHE_KEY = 'crafting-simulator-crafter-stats-v1';
const CRAFTER_JOB_PROFILES_CACHE_KEY = 'crafting-simulator-crafter-job-profiles-v1';
const SIMULATOR_PREFERENCES_CACHE_KEY = 'crafting-simulator-preferences-v1';
const CRAFTING_JOB_IDS = [8, 9, 10, 11, 12, 13, 14, 15];
const CRAFTER_STAT_RULES = {
  level: { min: 1 },
  craftsmanship: { min: 0 },
  control: { min: 0 },
  craft_points: { min: 0 },
};
const DEFAULT_SOLVER_OPTIONS = {
  targetQuality: null,
  useManipulation: true,
  useHeartAndSoul: false,
  useQuickInnovation: false,
  useTrainedEye: false,
  backloadProgress: false,
  adversarial: false,
};

function normalizeCrafterStats(rawStats, defaultStats) {
  if (!rawStats || typeof rawStats !== 'object') {
    return null;
  }

  const normalized = { ...defaultStats };

  for (const [key, rule] of Object.entries(CRAFTER_STAT_RULES)) {
    if (!(key in rawStats)) {
      return null;
    }

    const value = Number(rawStats[key]);
    if (!Number.isFinite(value)) {
      return null;
    }

    normalized[key] = Math.max(rule.min, Math.floor(value));
  }

  return normalized;
}

function loadCrafterStatsFromCache(defaultStats) {
  if (typeof window === 'undefined') {
    return { ...defaultStats };
  }

  try {
    const cachedRaw = window.localStorage.getItem(CRAFTER_STATS_CACHE_KEY);
    if (!cachedRaw) {
      return { ...defaultStats };
    }

    const parsed = JSON.parse(cachedRaw);
    const normalized = normalizeCrafterStats(parsed, defaultStats);

    if (!normalized) {
      window.localStorage.removeItem(CRAFTER_STATS_CACHE_KEY);
      return { ...defaultStats };
    }

    return normalized;
  } catch {
    window.localStorage.removeItem(CRAFTER_STATS_CACHE_KEY);
    return { ...defaultStats };
  }
}

function saveCrafterStatsToCache(crafterStats) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(CRAFTER_STATS_CACHE_KEY, JSON.stringify(crafterStats));
  } catch {
  }
}

function loadCrafterJobProfilesFromCache(defaultStats) {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const cachedRaw = window.localStorage.getItem(CRAFTER_JOB_PROFILES_CACHE_KEY);
    if (!cachedRaw) {
      return {};
    }

    const parsed = JSON.parse(cachedRaw);
    if (!parsed || typeof parsed !== 'object') {
      window.localStorage.removeItem(CRAFTER_JOB_PROFILES_CACHE_KEY);
      return {};
    }

    const normalizedProfiles = {};

    CRAFTING_JOB_IDS.forEach((jobId) => {
      const key = String(jobId);
      const normalized = normalizeCrafterStats(parsed[key], defaultStats);
      if (normalized) {
        normalizedProfiles[key] = normalized;
      }
    });

    return normalizedProfiles;
  } catch {
    window.localStorage.removeItem(CRAFTER_JOB_PROFILES_CACHE_KEY);
    return {};
  }
}

function saveCrafterJobProfilesToCache(jobProfiles) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(CRAFTER_JOB_PROFILES_CACHE_KEY, JSON.stringify(jobProfiles));
  } catch {
  }
}

function loadSimulatorPreferencesFromCache() {
  if (typeof window === 'undefined') {
    return {
      simulationMode: 'auto',
      solverOptions: { ...DEFAULT_SOLVER_OPTIONS },
    };
  }

  try {
    const cachedRaw = window.localStorage.getItem(SIMULATOR_PREFERENCES_CACHE_KEY);
    if (!cachedRaw) {
      return {
        simulationMode: 'auto',
        solverOptions: { ...DEFAULT_SOLVER_OPTIONS },
      };
    }

    const parsed = JSON.parse(cachedRaw);
    const simulationMode = parsed?.simulationMode === 'manual' ? 'manual' : 'auto';
    const solverOptions = {
      ...DEFAULT_SOLVER_OPTIONS,
      ...(parsed?.solverOptions && typeof parsed.solverOptions === 'object' ? parsed.solverOptions : {}),
    };

    return {
      simulationMode,
      solverOptions,
    };
  } catch {
    window.localStorage.removeItem(SIMULATOR_PREFERENCES_CACHE_KEY);
    return {
      simulationMode: 'auto',
      solverOptions: { ...DEFAULT_SOLVER_OPTIONS },
    };
  }
}

function saveSimulatorPreferencesToCache(preferences) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(SIMULATOR_PREFERENCES_CACHE_KEY, JSON.stringify(preferences));
  } catch {
  }
}

function formatActionName(action) {
  if (!action) return '未知技能';
  if (ACTION_NAMES[action]) return ACTION_NAMES[action];
  return action
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatPercent(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return '—';
  }

  const normalizedPercent = numericValue <= 1
    ? numericValue * 100
    : numericValue;

  const clampedPercent = Math.max(0, Math.min(normalizedPercent, 100));
  return `${Math.round(clampedPercent)}%`;
}

function formatConditionName(condition) {
  return CONDITION_NAMES[condition] || condition || '通常';
}

function formatSignedNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value) || value === 0) {
    return '±0';
  }

  return value > 0 ? `+${Math.round(value)}` : `${Math.round(value)}`;
}

function toFiniteNumber(value, fallback = 0) {
  const converted = Number(value);
  return Number.isFinite(converted) ? converted : fallback;
}

function getNestedStatusValue(status, path) {
  if (!status || !path) {
    return null;
  }

  const parts = path.split('.');
  let current = status;

  for (const part of parts) {
    if (!current || typeof current !== 'object' || !(part in current)) {
      return null;
    }
    current = current[part];
  }

  const numeric = Number(current);
  return Number.isFinite(numeric) ? numeric : null;
}

function localizeSimulationErrorMessage(rawMessage) {
  const message = String(rawMessage || '').trim();
  if (!message) {
    return null;
  }

  const normalized = message.toLowerCase();
  const knownMappings = [
    {
      patterns: ['player-level-lower-than-recipe-requirement', 'player level lower than recipe requirement'],
      text: '角色等級低於配方需求，請提升等級後再試。',
    },
    {
      patterns: ['insufficient-craft-points', 'not enough cp', 'insufficient cp'],
      text: 'CP 不足，無法執行目前技能或手法。',
    },
    {
      patterns: ['durability-not-enough', 'not enough durability', 'insufficient durability'],
      text: '耐久不足，無法繼續執行目前技能或手法。',
    },
    {
      patterns: ['invalid-action', 'action-not-allowed', 'action not allowed'],
      text: '目前狀態無法使用此技能。',
    },
  ];

  const matched = knownMappings.find((entry) => entry.patterns.some((pattern) => normalized.includes(pattern)));
  if (matched) {
    return matched.text;
  }

  if (/^[a-z0-9_.-]+$/i.test(message)) {
    return `模擬器錯誤代碼：${message}`;
  }

  return null;
}

function formatSolveFailureMessage(rawError, recipe, stats) {
  const rawMessage = rawError instanceof Error ? rawError.message : String(rawError || '');
  const normalized = rawMessage.toLowerCase();

  const noFeasiblePatterns = [
    'no solution',
    'no feasible',
    'infeasible',
    'cannot find',
    'unable to solve',
    'solver failed',
    '求解失敗',
    '無法求解',
    '找不到解',
    '可行',
  ];

  const isNoFeasible = noFeasiblePatterns.some((pattern) => normalized.includes(pattern));

  if (isNoFeasible) {
    return `目前條件找不到可行手法。請提高屬性或調整設定後再試。`;
  }

  const localized = localizeSimulationErrorMessage(rawMessage);
  if (localized) {
    return localized;
  }

  return rawMessage || '模擬製作失敗';
}

const BUFF_DURATION_CANDIDATES = [
  { label: '崇敬', paths: ['veneration', 'effects.veneration', 'buffs.veneration'] },
  { label: '改革', paths: ['innovation', 'effects.innovation', 'buffs.innovation'] },
  { label: '儉約', paths: ['waste_not', 'effects.waste_not', 'buffs.waste_not'] },
  { label: '掌握', paths: ['manipulation', 'effects.manipulation', 'buffs.manipulation'] },
  { label: '闊步', paths: ['great_strides', 'effects.great_strides', 'buffs.great_strides'] },
  { label: '堅信', paths: ['muscle_memory', 'effects.muscle_memory', 'buffs.muscle_memory'] },
  { label: '內靜', paths: ['inner_quiet', 'effects.inner_quiet', 'buffs.inner_quiet'] },
];

function normalizeStatusSnapshot(payload) {
  if (!payload) {
    return null;
  }

  if (payload.status && typeof payload.status === 'object') {
    return payload.status;
  }

  if (payload.state && typeof payload.state === 'object') {
    return payload.state;
  }

  if (payload.snapshot && typeof payload.snapshot === 'object') {
    return payload.snapshot;
  }

  if (payload.next_status && typeof payload.next_status === 'object') {
    return payload.next_status;
  }

  if (payload.result?.status && typeof payload.result.status === 'object') {
    return payload.result.status;
  }

  if (
    typeof payload === 'object'
    && (
      'progress' in payload
      || 'craft_points' in payload
      || 'condition' in payload
      || ('recipe' in payload && 'attributes' in payload)
    )
  ) {
    return payload;
  }

  if (Array.isArray(payload) && payload.length > 0) {
    const nestedSnapshot = payload
      .map((entry) => normalizeStatusSnapshot(entry))
      .find(Boolean);
    if (nestedSnapshot) {
      return nestedSnapshot;
    }
  }

  if (typeof payload === 'object') {
    const nestedSnapshot = Object.values(payload)
      .filter((candidate) => candidate && typeof candidate === 'object')
      .map((candidate) => normalizeStatusSnapshot(candidate))
      .find(Boolean);
    if (nestedSnapshot) {
      return nestedSnapshot;
    }
  }

  return payload;
}

function formatResourceDelta(delta, consumeLabel = '消耗', recoverLabel = '恢復') {
  const numeric = Number(delta);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return '不變';
  }

  if (numeric < 0) {
    return `${consumeLabel} ${Math.abs(Math.round(numeric))}`;
  }

  return `${recoverLabel} ${Math.round(numeric)}`;
}

function getDeltaColorClass(delta) {
  const numeric = Number(delta);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return 'text-slate-300';
  }

  return numeric > 0 ? 'text-emerald-300' : 'text-red-300';
}

function formatDeltaOrUnchanged(delta) {
  const numeric = Number(delta);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return '不變';
  }

  return formatSignedNumber(numeric);
}

const MACRO_MAX_LINES = 15;
const MACRO_ACTIONS_PER_PAGE = MACRO_MAX_LINES - 1;

function buildMacroPages(actions, chunkSize = MACRO_ACTIONS_PER_PAGE) {
  if (!actions?.length) {
    return [];
  }

  const chunks = [];
  let index = 0;

  while (index < actions.length) {
    const remaining = actions.length - index;
    const currentChunkSize = remaining <= MACRO_MAX_LINES ? remaining : chunkSize;
    chunks.push(actions.slice(index, index + currentChunkSize));
    index += currentChunkSize;
  }

  return chunks.map((chunk, chunkIndex) => {
    const isLastPage = chunkIndex === chunks.length - 1;
    const lines = chunk.map((action) => `/ac "${formatActionName(action)}" <wait.3>`);

    return {
      index: chunkIndex,
      text: lines.join('\n'),
      lines,
    };
  });
}

function ProgressBar({ label, current, max, barClass, valueClass = 'text-white' }) {
  const safeCurrent = toFiniteNumber(current, 0);
  const safeMaxValue = toFiniteNumber(max, 0);
  const safeMax = safeMaxValue > 0 ? safeMaxValue : 0;
  const pct = safeMax > 0 ? Math.min((safeCurrent / safeMax) * 100, 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs sm:text-sm">
        <span className="text-slate-400">{label}</span>
        <span className={`font-semibold ${valueClass}`}>
          {Math.round(safeCurrent)} / {Math.round(safeMax)}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-950/95 overflow-hidden border border-white/10">
        <div className={`h-full transition-all duration-500 ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MetricCard({ label, value, accentClass = 'text-ffxiv-gold' }) {
  return (
    <div className="rounded-xl border border-purple-400/30 bg-slate-800/85 px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="text-xs uppercase tracking-[0.14em] text-slate-300 leading-5">{label}</div>
      <div className={`mt-1 text-base sm:text-lg font-bold leading-6 sm:leading-7 ${accentClass}`}>{value}</div>
    </div>
  );
}

export default function CraftingSimulatorDrawer({ isOpen, item, onClose }) {
  const cachedPreferences = useMemo(() => loadSimulatorPreferencesFromCache(), []);
  const [recipes, setRecipes] = useState([]);
  const [recipe, setRecipe] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [ingredientsLoading, setIngredientsLoading] = useState(false);
  const [recipeCount, setRecipeCount] = useState(0);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [runningSolver, setRunningSolver] = useState(false);
  const [needsSolve, setNeedsSolve] = useState(true);
  const [error, setError] = useState(null);
  const [simulationResult, setSimulationResult] = useState(null);
  const [copyState, setCopyState] = useState('idle');
  const [macroPageIndex, setMacroPageIndex] = useState(0);
  const [rightPanelTab, setRightPanelTab] = useState('rotation');
  const [simulationMode, setSimulationMode] = useState(cachedPreferences.simulationMode);
  const [manualActions, setManualActions] = useState([]);
  const [manualInitialStatus, setManualInitialStatus] = useState(null);
  const [manualResult, setManualResult] = useState(null);
  const [manualRunError, setManualRunError] = useState(null);
  const [manualStepStatus, setManualStepStatus] = useState(null);
  const [manualStepIndex, setManualStepIndex] = useState(0);
  const [manualStepError, setManualStepError] = useState(null);
  const [draggedActionIndex, setDraggedActionIndex] = useState(null);
  const [allowedActionMap, setAllowedActionMap] = useState({});
  const [actionExecutableMap, setActionExecutableMap] = useState({});
  const [actionCpMap, setActionCpMap] = useState({});
  const [actionDurabilityCostMap, setActionDurabilityCostMap] = useState({});
  const [isLoadingActionMeta, setIsLoadingActionMeta] = useState(false);
  const [solverOptions, setSolverOptions] = useState(cachedPreferences.solverOptions);

  const defaultStats = useMemo(() => getDefaultCrafterAttributes(), []);
  const [crafterStats, setCrafterStats] = useState(() => loadCrafterStatsFromCache(defaultStats));
  const [crafterJobProfiles, setCrafterJobProfiles] = useState(() => loadCrafterJobProfilesFromCache(defaultStats));
  const [isJobProfilesOpen, setIsJobProfilesOpen] = useState(false);
  const [jobProfileState, setJobProfileState] = useState({ type: 'idle', jobId: null });
  const [ingredientHqCounts, setIngredientHqCounts] = useState({});
  const solveRequestIdRef = useRef(0);
  const backdropPointerDownRef = useRef(null);
  const itemName = item?.nameTW || item?.name || '未知物品';

  const handleCrafterStatChange = (key, nextValue, min = 0) => {
    const parsed = Number(nextValue);
    const safeValue = Number.isFinite(parsed) ? Math.max(Math.floor(parsed), min) : min;
    setCrafterStats((previous) => ({
      ...previous,
      [key]: safeValue,
    }));
  };

  const handleResetCrafterStats = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CRAFTER_STATS_CACHE_KEY);
    }
    setCrafterStats({ ...defaultStats });
  };

  const handleToggleJobProfiles = () => {
    setIsJobProfilesOpen((previous) => !previous);
  };

  const handleSaveCrafterStatsForJob = (jobId) => {
    const normalizedJobId = String(jobId);
    const statsToSave = normalizeCrafterStats(crafterStats, defaultStats);
    if (!statsToSave) {
      setJobProfileState({ type: 'missing', jobId: normalizedJobId });
      return;
    }

    setCrafterJobProfiles((previous) => ({
      ...previous,
      [normalizedJobId]: { ...statsToSave },
    }));
    setJobProfileState({ type: 'saved', jobId: normalizedJobId });
  };

  const handleLoadCrafterStatsForJob = (jobId) => {
    const normalizedJobId = String(jobId);
    const profile = crafterJobProfiles[normalizedJobId];
    const normalizedStats = normalizeCrafterStats(profile, defaultStats);

    if (!normalizedStats) {
      setJobProfileState({ type: 'missing', jobId: normalizedJobId });
      return;
    }

    setCrafterStats(normalizedStats);
    setJobProfileState({ type: 'loaded', jobId: normalizedJobId });
  };

  const handleIngredientHqChange = (ingredientKey, maxAmount, nextValue) => {
    const parsed = Number(nextValue);
    const safeValue = Number.isFinite(parsed)
      ? Math.max(0, Math.min(Math.floor(parsed), Math.max(0, Math.floor(maxAmount || 0))))
      : 0;

    setIngredientHqCounts((previous) => ({
      ...previous,
      [ingredientKey]: safeValue,
    }));
  };

  const startingQuality = useMemo(() => {
    if (!ingredients.length) {
      return 0;
    }

    return ingredients.reduce((total, ingredient) => {
      const hqAmount = ingredientHqCounts[ingredient.key] || 0;
      const ingredientQuality = Number(ingredient.quality) || 0;
      return total + hqAmount * ingredientQuality;
    }, 0);
  }, [ingredients, ingredientHqCounts]);
  const clampedStartingQuality = Math.max(0, Math.min(startingQuality, recipe?.quality || 0));

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setCrafterStats(loadCrafterStatsFromCache(defaultStats));
  }, [defaultStats, isOpen]);

  useEffect(() => {
    saveCrafterStatsToCache(crafterStats);
  }, [crafterStats]);

  useEffect(() => {
    saveCrafterJobProfilesToCache(crafterJobProfiles);
  }, [crafterJobProfiles]);

  useEffect(() => {
    saveSimulatorPreferencesToCache({
      simulationMode,
      solverOptions,
    });
  }, [simulationMode, solverOptions]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !item?.id) {
      setRecipes([]);
      setRecipe(null);
      setIngredients([]);
      setRecipeCount(0);
      setSimulationResult(null);
      setManualActions([]);
      setManualInitialStatus(null);
      setManualResult(null);
      setManualRunError(null);
      setManualStepStatus(null);
      setManualStepIndex(0);
      setManualStepError(null);
      setDraggedActionIndex(null);
      setAllowedActionMap({});
      setActionExecutableMap({});
      setActionCpMap({});
      setActionDurabilityCostMap({});
      setError(null);
      setCopyState('idle');
      setMacroPageIndex(0);
      setRightPanelTab('rotation');
      setIngredientHqCounts({});
      setNeedsSolve(true);
      setIsJobProfilesOpen(false);
      setJobProfileState({ type: 'idle', jobId: null });
      return;
    }

    let cancelled = false;

    const loadRecipes = async () => {
      try {
        setLoadingRecipe(true);
        setError(null);
        setCopyState('idle');
        setMacroPageIndex(0);
        setRightPanelTab('rotation');
        setManualActions([]);
        setManualInitialStatus(null);
        setManualResult(null);
        setManualRunError(null);
        setManualStepStatus(null);
        setManualStepIndex(0);
        setManualStepError(null);
        setDraggedActionIndex(null);
        setAllowedActionMap({});
        setActionExecutableMap({});
        setActionCpMap({});
        setActionDurabilityCostMap({});
        setIngredientHqCounts({});
        setNeedsSolve(true);

        const foundRecipes = await findRecipesByResult(item.id);
        if (cancelled) return;

        setRecipes(foundRecipes);
        setRecipeCount(foundRecipes.length);

        if (!foundRecipes.length) {
          throw new Error('找不到可用的製作配方');
        }

        setRecipe((currentRecipe) => {
          if (currentRecipe) {
            const matchedRecipe = foundRecipes.find((candidate) => candidate.id === currentRecipe.id);
            if (matchedRecipe) {
              return matchedRecipe;
            }
          }

          return foundRecipes[0];
        });
      } catch (simulationError) {
        if (!cancelled) {
          setError(simulationError instanceof Error ? simulationError.message : '模擬製作失敗');
        }
      } finally {
        if (!cancelled) {
          setLoadingRecipe(false);
        }
      }
    };

    loadRecipes();
    return () => {
      cancelled = true;
    };
  }, [isOpen, item?.id]);

  useEffect(() => {
    if (!isOpen || !recipe) {
      return;
    }

    solveRequestIdRef.current += 1;
    setRunningSolver(false);
    setSimulationResult(null);
    setManualResult(null);
    setManualRunError(null);
    setManualStepStatus(null);
    setManualStepIndex(0);
    setManualStepError(null);
    setCopyState('idle');
    setMacroPageIndex(0);
    setNeedsSolve(true);
    setError(null);
  }, [clampedStartingQuality, crafterStats, isOpen, recipe, solverOptions]);

  useEffect(() => {
    if (!isOpen || !recipe || simulationMode !== 'manual') {
      setManualInitialStatus(null);
      return;
    }

    let cancelled = false;

    const initializeManualStatus = async () => {
      try {
        const simulatorRecipe = convertRecipeToSimulatorRecipe(recipe);
        const status = await createCraftingStatus(crafterStats, simulatorRecipe);
        status.quality = Math.floor(clampedStartingQuality);

        if (cancelled) {
          return;
        }

        setManualInitialStatus(status);
        setManualResult({
          status,
          errors: [],
        });
        setManualRunError(null);
        setManualStepStatus(status);
        setManualStepIndex(0);
        setManualStepError(null);
      } catch (manualInitError) {
        if (!cancelled) {
          setManualInitialStatus(null);
          const rawMessage = manualInitError instanceof Error ? manualInitError.message : '手動狀態初始化失敗';
          setManualRunError(localizeSimulationErrorMessage(rawMessage) || rawMessage);
        }
      }
    };

    initializeManualStatus();
    return () => {
      cancelled = true;
    };
  }, [clampedStartingQuality, crafterStats, isOpen, recipe, simulationMode]);

  const handleStartSolve = async () => {
    if (!isOpen || !recipe || runningSolver) {
      return;
    }

    const requestId = solveRequestIdRef.current + 1;
    solveRequestIdRef.current = requestId;

    try {
      setRunningSolver(true);
      setError(null);
      setCopyState('idle');
      setMacroPageIndex(0);

      const result = await runAutoCraftSimulation(recipe, crafterStats, { ...solverOptions, solverType: 'raphael' }, clampedStartingQuality);
      if (solveRequestIdRef.current !== requestId) {
        return;
      }

      const finalProgress = toFiniteNumber(result?.finalStatus?.progress, 0);
      const requiredProgress = toFiniteNumber(result?.finalStatus?.recipe?.difficulty, 0);
      const hasActions = Array.isArray(result?.actions) && result.actions.length > 0;

      if (!hasActions || (requiredProgress > 0 && finalProgress < requiredProgress)) {
        setSimulationResult(null);
        setNeedsSolve(true);
        setError(formatSolveFailureMessage(new Error('No feasible solution'), recipe, crafterStats));
        return;
      }

      setSimulationResult(result);
      setNeedsSolve(false);
    } catch (simulationError) {
      if (solveRequestIdRef.current !== requestId) {
        return;
      }

      setError(formatSolveFailureMessage(simulationError, recipe, crafterStats));
      setNeedsSolve(true);
    } finally {
      if (solveRequestIdRef.current === requestId) {
        setRunningSolver(false);
      }
    }
  };

  useEffect(() => {
    const initialStatus = simulationMode === 'manual' ? manualInitialStatus : simulationResult?.initialStatus;
    if (!isOpen || !initialStatus) {
      setManualResult(null);
      setManualRunError(null);
      return;
    }

    let cancelled = false;

    const runManualSimulation = async () => {
      try {
        if (!manualActions.length) {
          setManualResult({
            status: initialStatus,
            errors: [],
          });
          setManualRunError(null);
          return;
        }

        const result = await simulateCrafting(initialStatus, manualActions);
        if (cancelled) return;

        setManualResult(result);
        setManualRunError(null);
      } catch (manualError) {
        if (!cancelled) {
          const rawMessage = manualError instanceof Error ? manualError.message : '手動模擬失敗';
          setManualRunError(localizeSimulationErrorMessage(rawMessage) || rawMessage);
        }
      }
    };

    runManualSimulation();
    return () => {
      cancelled = true;
    };
  }, [isOpen, manualActions, manualInitialStatus, simulationMode, simulationResult?.initialStatus]);

  useEffect(() => {
    const initialStatus = simulationMode === 'manual' ? manualInitialStatus : simulationResult?.initialStatus;
    if (!isOpen || !initialStatus) {
      setManualStepStatus(null);
      setManualStepIndex(0);
      setManualStepError(null);
      return;
    }

    setManualStepStatus(initialStatus);
    setManualStepIndex(0);
    setManualStepError(null);
  }, [isOpen, manualInitialStatus, simulationResult?.initialStatus, manualActions, simulationMode]);

  useEffect(() => {
    const currentStatus = simulationMode === 'manual'
      ? (manualResult?.status || manualStepStatus || manualInitialStatus || simulationResult?.initialStatus)
      : simulationResult?.initialStatus;

    if (!isOpen || !currentStatus) {
      setAllowedActionMap({});
      setActionExecutableMap({});
      setActionCpMap({});
      setActionDurabilityCostMap({});
      return;
    }

    let cancelled = false;

    const loadActionMeta = async () => {
      try {
        setIsLoadingActionMeta(true);
        const [allowedResults, cpResults, durabilityCosts] = await Promise.all([
          getAllowedActions(currentStatus, ALL_MANUAL_ACTIONS),
          getCraftPointsList(currentStatus, ALL_MANUAL_ACTIONS),
          Promise.all(
            ALL_MANUAL_ACTIONS.map(async (action) => {
              try {
                const oneStepResult = await simulateCraftingOneStep(currentStatus, action, true);
                const currentDurability = toFiniteNumber(currentStatus?.durability, 0);
                const nextDurability = toFiniteNumber(oneStepResult?.status?.durability, currentDurability);
                return {
                  durabilityCost: Math.max(0, Math.round(currentDurability - nextDurability)),
                  executable: !!oneStepResult?.is_success,
                };
              } catch {
                return {
                  durabilityCost: 0,
                  executable: false,
                };
              }
            }),
          ),
        ]);
        if (cancelled) return;

        const nextAllowedMap = {};
        const nextExecutableMap = {};
        const nextCpMap = {};
        const nextDurabilityCostMap = {};

        ALL_MANUAL_ACTIONS.forEach((action, index) => {
          nextAllowedMap[action] = allowedResults[index] === 'ok';
          nextExecutableMap[action] = durabilityCosts[index]?.executable ?? false;
          nextCpMap[action] = cpResults[index];
          nextDurabilityCostMap[action] = durabilityCosts[index]?.durabilityCost || 0;
        });

        setAllowedActionMap(nextAllowedMap);
        setActionExecutableMap(nextExecutableMap);
        setActionCpMap(nextCpMap);
        setActionDurabilityCostMap(nextDurabilityCostMap);
      } catch (metaError) {
        if (!cancelled) {
          console.warn('[CraftingSimulator] Failed to load action meta:', metaError);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingActionMeta(false);
        }
      }
    };

    loadActionMeta();
    return () => {
      cancelled = true;
    };
  }, [isOpen, manualInitialStatus, manualResult?.status, manualStepStatus, simulationMode, simulationResult?.initialStatus]);

  useEffect(() => {
    if (!isOpen || !recipe?.ingredients?.length) {
      setIngredients([]);
      return undefined;
    }

    let cancelled = false;

    const loadIngredients = async () => {
      try {
        setIngredientsLoading(true);

        const ingredientDetails = await Promise.all(
          recipe.ingredients.map(async (ingredient, index) => {
            const itemData = await getItemById(ingredient.id);
            return {
              key: `${ingredient.id}-${index}`,
              id: ingredient.id,
              amount: ingredient.amount || 0,
              quality: Number(ingredient.quality) || 0,
              name: itemData?.nameTW || itemData?.name || `物品 ${ingredient.id}`,
            };
          }),
        );

        if (!cancelled) {
          setIngredients(ingredientDetails);
        }
      } catch (ingredientError) {
        if (!cancelled) {
          console.warn('[CraftingSimulator] Failed to load ingredient names:', ingredientError);
          setIngredients((recipe.ingredients || []).map((ingredient, index) => ({
            key: `${ingredient.id}-${index}`,
            id: ingredient.id,
            amount: ingredient.amount || 0,
            quality: Number(ingredient.quality) || 0,
            name: `物品 ${ingredient.id}`,
          })));
        }
      } finally {
        if (!cancelled) {
          setIngredientsLoading(false);
        }
      }
    };

    loadIngredients();
    return () => {
      cancelled = true;
    };
  }, [isOpen, recipe]);

  const finalStatus = simulationResult?.finalStatus;
  const jobName = recipe ? (JOB_NAMES[recipe.job] || `職業 ${recipe.job}`) : '讀取中';
  const jobIcon = recipe ? JOB_ICON_MAP[recipe.job] : null;
  const jobProfileStatusText = useMemo(() => {
    if (!jobProfileState || jobProfileState.type === 'idle') {
      return null;
    }

    const savedJobName = JOB_NAMES[jobProfileState.jobId] || `職業 ${jobProfileState.jobId}`;

    if (jobProfileState.type === 'saved') {
      return `已保存目前屬性到 ${savedJobName}`;
    }

    if (jobProfileState.type === 'loaded') {
      return `已讀取 ${savedJobName} 的已保存屬性`;
    }

    return `${savedJobName} 尚未保存屬性`;
  }, [jobProfileState]);
  const recipeYield = recipe?.yields || 1;
  const trainedEyeEligible = crafterStats.level >= (recipe?.lvl || 0) + 10;
  const firstError = simulationResult?.errors?.[0];
  const errorPositions = new Set((simulationResult?.errors || []).map((entry) => entry.pos));
  const detailedStatuses = simulationResult?.detailedStatuses || [];
  const manualStatus = manualResult?.status || manualStepStatus || manualInitialStatus || simulationResult?.initialStatus || null;
  const activeActions = simulationMode === 'manual' ? manualActions : (simulationResult?.actions || []);
  const activeStatus = simulationMode === 'manual'
    ? (manualResult?.status || manualStepStatus || manualInitialStatus || simulationResult?.initialStatus)
    : finalStatus;
  const isComplete = !!(activeStatus && activeStatus.progress >= activeStatus.recipe.difficulty);
  const isQualityMax = !!(activeStatus && activeStatus.recipe.quality > 0 && activeStatus.quality >= activeStatus.recipe.quality);
  const hasFailure = !!(activeStatus && activeStatus.durability <= 0 && !isComplete);
  const activeErrors = simulationMode === 'manual' ? (manualResult?.errors || []) : (simulationResult?.errors || []);
  const activeErrorPositions = new Set(activeErrors.map((entry) => entry.pos));
  const activeMacroPages = useMemo(() => buildMacroPages(activeActions), [activeActions]);
  const activeBuffDurations = BUFF_DURATION_CANDIDATES
    .map((buff) => {
      const value = buff.paths
        .map((path) => getNestedStatusValue(activeStatus, path))
        .find((candidate) => candidate !== null && candidate > 0);

      return value ? { label: buff.label, value: Math.round(value) } : null;
    })
    .filter(Boolean);
  const currentMacroPage = activeMacroPages[Math.min(macroPageIndex, Math.max(activeMacroPages.length - 1, 0))] || null;
  const macroPreviewLines = currentMacroPage?.lines || [];

  useEffect(() => {
    setMacroPageIndex(0);
  }, [simulationMode, activeActions.join('|')]);

  useEffect(() => {
    if (macroPageIndex <= Math.max(activeMacroPages.length - 1, 0)) {
      return;
    }

    setMacroPageIndex(Math.max(activeMacroPages.length - 1, 0));
  }, [activeMacroPages.length, macroPageIndex]);

  const handleCopyMacro = async () => {
    if (!currentMacroPage?.text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(currentMacroPage.text);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1800);
    } catch (copyError) {
      console.warn('[CraftingSimulator] Failed to copy macro:', copyError);
      setCopyState('failed');
      window.setTimeout(() => setCopyState('idle'), 2200);
    }
  };

  const handleAddManualAction = async (action) => {
    const currentStatus = manualResult?.status || manualStepStatus || manualInitialStatus || simulationResult?.initialStatus;
    if (!currentStatus || isLoadingActionMeta) {
      return;
    }

    if (UNSIMULATABLE_ACTIONS.includes(action)) {
      return;
    }

    const isOpeningAction = MANUAL_ACTION_CATEGORIES.opening.includes(action);
    if (isOpeningAction && manualActions.length > 0) {
      return;
    }

    try {
      const oneStepResult = await simulateCraftingOneStep(currentStatus, action, true);
      if (!oneStepResult?.is_success) {
        return;
      }

      setManualActions((prev) => {
        if (isOpeningAction && prev.length > 0) {
          return prev;
        }
        return [...prev, action];
      });
    } catch {
    }
  };

  const handleManualActionDrop = (targetIndex) => {
    if (draggedActionIndex === null || draggedActionIndex === targetIndex) {
      setDraggedActionIndex(null);
      return;
    }

    setManualActions((previous) => {
      // Prevent displacing an opening skill from position 0
      const isOpeningAtZero = previous.length > 0 && MANUAL_ACTION_CATEGORIES.opening.includes(previous[0]);
      if (isOpeningAtZero && targetIndex === 0) {
        return previous;
      }
      const next = [...previous];
      const [movedAction] = next.splice(draggedActionIndex, 1);
      next.splice(targetIndex, 0, movedAction);
      return next;
    });
    setDraggedActionIndex(null);
  };

  const handleRunNextManualStep = async () => {
    const initialStatus = manualInitialStatus || simulationResult?.initialStatus;
    if (!initialStatus || manualStepIndex >= manualActions.length) {
      return;
    }

    try {
      const action = manualActions[manualStepIndex];
      const currentStatus = manualStepStatus || initialStatus;
      const result = await simulateCraftingOneStep(currentStatus, action, true);

      setManualStepStatus(result.status);
      setManualStepIndex((previous) => previous + 1);
      setManualStepError(result.is_success ? null : `第 ${manualStepIndex + 1} 步執行失敗`);
    } catch (stepError) {
      setManualStepError(stepError instanceof Error ? stepError.message : '逐步執行失敗');
    }
  };

  const handleResetManualStep = () => {
    const initialStatus = manualInitialStatus || simulationResult?.initialStatus;
    if (!initialStatus) {
      return;
    }

    setManualStepStatus(initialStatus);
    setManualStepIndex(0);
    setManualStepError(null);
  };

  const handleBackdropPointerDown = (event) => {
    if (event.target !== event.currentTarget) {
      backdropPointerDownRef.current = null;
      return;
    }

    backdropPointerDownRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handleBackdropPointerUp = (event) => {
    if (event.target !== event.currentTarget) {
      backdropPointerDownRef.current = null;
      return;
    }

    const pointerDown = backdropPointerDownRef.current;
    backdropPointerDownRef.current = null;
    if (!pointerDown) {
      return;
    }

    const movedDistance = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
    if (movedDistance <= 6) {
      onClose();
    }
  };

  if (!isOpen || !item) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-6"
      onPointerDown={handleBackdropPointerDown}
      onPointerUp={handleBackdropPointerUp}
    >
      <div
        className="relative h-[min(92vh,980px)] w-[min(96vw,1420px)] rounded-2xl bg-gradient-to-b from-slate-800 via-slate-850 to-slate-950 border border-purple-400/35 shadow-[0_24px_90px_rgba(0,0,0,0.58)] overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-purple-400/30 bg-slate-900/97 backdrop-blur-md px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-ffxiv-gold break-words">製作模擬器</h2>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-slate-800/80 p-2 text-slate-300 transition hover:border-ffxiv-gold/50 hover:text-ffxiv-gold"
              title="關閉模擬面板"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div
          className="h-[calc(92vh-120px)] max-h-[860px] overflow-y-auto px-4 sm:px-6 pr-6 sm:pr-8 py-4 space-y-3 bg-slate-900/35"
          style={{ scrollbarGutter: 'stable' }}
        >

          <div className="xl:grid xl:grid-cols-[25%_50%_25%] xl:gap-3 items-start">
            <div className="space-y-3">

          <div className="rounded-2xl border border-ffxiv-gold/25 bg-slate-800/80 p-3.5 sm:p-4 shadow-[0_0_20px_rgba(212,175,55,0.08)]">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-ffxiv-gold/30 bg-slate-950/70 p-2">
                <ItemImage itemId={item.id} alt={itemName} className="h-10 w-10 object-contain" priority />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-cyan-300">
                    <span>自動模擬製作</span>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 border border-emerald-500/20">產出 ×{recipeYield}</span>
                  {recipe?.lvl ? <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold text-purple-200 border border-purple-500/20">Lv.{recipe.lvl}</span> : null}
                </div>
                <h3 className="mt-1.5 text-sm sm:text-base font-bold text-ffxiv-gold truncate">{itemName}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] sm:textjues text-slate-400">
                  {jobIcon && <img src={jobIcon} alt={jobName} className="h-4 w-4 object-contain" />}
                  <span>{jobName}</span>
                  {recipeCount > 1 ? <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-300 border border-amber-500/20">{recipeCount} 配方</span> : null}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-purple-400/25 bg-slate-900/70 px-3 py-2.5 space-y-2.5">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <div className="text-[11px] font-semibold tracking-wide text-cyan-200">可調整角色屬性</div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleToggleJobProfiles}
                    className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold text-cyan-200 transition hover:border-cyan-400/50 hover:text-cyan-100"
                  >
                    職業存取
                  </button>
                  <button
                    type="button"
                    onClick={handleResetCrafterStats}
                    className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300 transition hover:border-amber-400/50 hover:text-amber-200"
                  >
                    重置預設
                  </button>
                </div>
              </div>
              {isJobProfilesOpen ? (
                <div className="mb-2 rounded-lg border border-cyan-500/25 bg-slate-950/70 p-2">
                  <div className="text-[10px] text-cyan-300/85">選擇製作職業，可保存目前屬性或讀取已保存屬性。</div>
                  <div className="mt-1.5 space-y-1.5">
                    {CRAFTING_JOB_IDS.map((jobId) => {
                      const profile = crafterJobProfiles[String(jobId)] || null;
                      const profileJobName = JOB_NAMES[jobId] || `職業 ${jobId}`;
                      const profileJobIcon = JOB_ICON_MAP[jobId] || null;

                      return (
                        <div key={jobId} className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-slate-900/70 px-2 py-1.5">
                          <div className="flex min-w-0 items-center gap-1.5">
                            {profileJobIcon ? <img src={profileJobIcon} alt={profileJobName} className="h-4 w-4 object-contain" /> : null}
                            <span className="truncate text-[11px] font-medium text-slate-100">{profileJobName}</span>
                            {profile ? <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">已保存</span> : null}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleLoadCrafterStatsForJob(jobId)}
                              disabled={!profile}
                              className="rounded border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-purple-200 transition hover:border-purple-400/50 hover:text-purple-100 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              讀取
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveCrafterStatsForJob(jobId)}
                              className="rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200 transition hover:border-cyan-400/50 hover:text-cyan-100"
                            >
                              保存
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {jobProfileStatusText ? <div className="mt-1.5 text-[10px] text-cyan-200">{jobProfileStatusText}</div> : null}
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-2 py-1.5 text-cyan-200 cursor-text">
                  <div className="text-[10px] uppercase tracking-wide text-cyan-300/80">Lv</div>
                  <input
                    type="number"
                    min={1}
                    value={crafterStats.level}
                    onChange={(event) => handleCrafterStatChange('level', event.target.value, 1)}
                    className="mt-1 w-full rounded-md border border-cyan-400/25 bg-slate-950/70 px-1.5 py-1 text-sm font-semibold text-cyan-100 outline-none focus:border-cyan-300/70 focus:ring-1 focus:ring-cyan-300/40"
                  />
                </label>
                <label className="rounded-lg border border-purple-500/35 bg-purple-500/10 px-2 py-1.5 text-purple-200 cursor-text">
                  <div className="text-[10px] uppercase tracking-wide text-purple-300/80">作業</div>
                  <input
                    type="number"
                    min={0}
                    value={crafterStats.craftsmanship}
                    onChange={(event) => handleCrafterStatChange('craftsmanship', event.target.value, 0)}
                    className="mt-1 w-full rounded-md border border-purple-400/25 bg-slate-950/70 px-1.5 py-1 text-sm font-semibold text-purple-100 outline-none focus:border-purple-300/70 focus:ring-1 focus:ring-purple-300/40"
                  />
                </label>
                <label className="rounded-lg border border-violet-500/35 bg-violet-500/10 px-2 py-1.5 text-violet-200 cursor-text">
                  <div className="text-[10px] uppercase tracking-wide text-violet-300/80">加工</div>
                  <input
                    type="number"
                    min={0}
                    value={crafterStats.control}
                    onChange={(event) => handleCrafterStatChange('control', event.target.value, 0)}
                    className="mt-1 w-full rounded-md border border-violet-400/25 bg-slate-950/70 px-1.5 py-1 text-sm font-semibold text-violet-100 outline-none focus:border-violet-300/70 focus:ring-1 focus:ring-violet-300/40"
                  />
                </label>
                <label className="rounded-lg border border-pink-500/35 bg-pink-500/10 px-2 py-1.5 text-pink-200 cursor-text">
                  <div className="text-[10px] uppercase tracking-wide text-pink-300/80">CP</div>
                  <input
                    type="number"
                    min={0}
                    value={crafterStats.craft_points}
                    onChange={(event) => handleCrafterStatChange('craft_points', event.target.value, 0)}
                    className="mt-1 w-full rounded-md border border-pink-400/25 bg-slate-950/70 px-1.5 py-1 text-sm font-semibold text-pink-100 outline-none focus:border-pink-300/70 focus:ring-1 focus:ring-pink-300/40"
                  />
                </label>
              </div>
            </div>

          </div>

          <div className="rounded-xl border border-cyan-400/30 bg-slate-900/95 backdrop-blur-md px-3 py-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-cyan-200">即時製作狀態</div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-300">
                <span>{simulationMode === 'manual' ? '手動' : '自動'}</span>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-1 gap-2">
              <ProgressBar
                label="進展"
                current={toFiniteNumber(activeStatus?.progress, 0)}
                max={toFiniteNumber(activeStatus?.recipe?.difficulty, 0)}
                barClass="bg-gradient-to-r from-blue-500 to-cyan-400"
                valueClass="text-blue-200"
              />
              <ProgressBar
                label="品質"
                current={toFiniteNumber(activeStatus?.quality, 0)}
                max={toFiniteNumber(activeStatus?.recipe?.quality, 0)}
                barClass="bg-gradient-to-r from-orange-500 to-amber-400"
                valueClass="text-orange-200"
              />
              <ProgressBar
                label="耐久"
                current={toFiniteNumber(activeStatus?.durability, 0)}
                max={toFiniteNumber(activeStatus?.recipe?.durability, 0)}
                barClass="bg-gradient-to-r from-yellow-500 to-lime-400"
                valueClass="text-yellow-200"
              />
              <ProgressBar
                label="CP"
                current={toFiniteNumber(activeStatus?.craft_points, 0)}
                max={toFiniteNumber(activeStatus?.attributes?.craft_points, 0)}
                barClass="bg-gradient-to-r from-pink-500 to-fuchsia-400"
                valueClass="text-pink-200"
              />
            </div>

            {simulationMode === 'manual' && activeBuffDurations.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-cyan-500/20 pt-2">
                <span className="text-[11px] text-cyan-200/80">Buff</span>
                {activeBuffDurations.map((buff) => (
                  <span
                    key={buff.label}
                    className="rounded border border-cyan-500/25 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan-200"
                  >
                    {buff.label} {buff.value}
                  </span>
                ))}
              </div>
            )}
          </div>

          {recipes.length > 1 && (
            <div className="rounded-2xl border border-purple-400/30 bg-slate-800/75 p-4 sm:p-5">
              <div className="flex flex-col gap-3">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-white">配方選擇</h3>
                  <p className="text-xs sm:text-sm text-slate-400">同一物品若有多個可製作配方，可直接切換並重新求解。</p>
                </div>
                <div className="w-full">
                  <select
                    value={recipe?.id || ''}
                    onChange={(event) => {
                      const nextRecipe = recipes.find((candidate) => candidate.id === Number(event.target.value));
                      if (nextRecipe) {
                        setRecipe(nextRecipe);
                      }
                    }}
                    className="w-full rounded-xl border border-purple-500/25 bg-slate-950/90 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-ffxiv-gold/50"
                  >
                    {recipes.map((candidate, index) => (
                      <option key={candidate.id} value={candidate.id}>
                        {`配方 ${index + 1}｜${JOB_NAMES[candidate.job] || `職業 ${candidate.job}`}｜Lv.${candidate.lvl || 0}｜耐久 ${candidate.durability || 0}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

            </div>

            <div className="space-y-3">

          <div className="rounded-2xl border border-purple-400/30 bg-slate-800/75 p-3.5 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-white">模擬模式</h3>
              </div>
              <div className="inline-flex rounded-xl border border-purple-500/25 bg-slate-950/70 p-1">
                <button
                  onClick={() => setSimulationMode('auto')}
                  className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg transition ${simulationMode === 'auto' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  自動解
                </button>
                <button
                  onClick={() => {
                    setSimulationMode('manual');
                    setManualActions([]);
                    setManualResult(null);
                    setManualRunError(null);
                    setManualStepStatus(null);
                    setManualStepIndex(0);
                    setManualStepError(null);
                  }}
                  className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg transition ${simulationMode === 'manual' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  手動
                </button>
              </div>
            </div>

            {simulationMode === 'auto' && (
              <div className="rounded-xl border border-purple-500/20 bg-slate-950/55 p-2.5">
                <div className="mb-2 text-xs font-semibold text-slate-300">自動解設定</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="group flex w-full items-center gap-2 rounded-lg border border-purple-500/20 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-300 transition hover:border-cyan-400/40 hover:bg-slate-900/80">
                    <input
                      type="checkbox"
                      checked={solverOptions.useManipulation}
                      onChange={(event) => setSolverOptions((prev) => ({ ...prev, useManipulation: event.target.checked }))}
                      className="peer sr-only"
                    />
                    <span className="flex h-4 w-4 items-center justify-center rounded border border-slate-500/80 bg-slate-900/90 text-cyan-200 transition peer-checked:border-cyan-300 peer-checked:bg-cyan-500/20 peer-checked:shadow-[0_0_0_1px_rgba(34,211,238,0.35)]">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 opacity-0 transition peer-checked:opacity-100">
                        <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.414l-7.2 7.2a1 1 0 01-1.414 0l-3.2-3.2a1 1 0 111.414-1.414L8.8 11.786l6.493-6.496a1 1 0 011.411 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="transition group-hover:text-cyan-200">使用掌握</span>
                  </label>
                  <label className="group flex w-full items-center gap-2 rounded-lg border border-purple-500/20 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-300 transition hover:border-cyan-400/40 hover:bg-slate-900/80">
                    <input
                      type="checkbox"
                      checked={solverOptions.useHeartAndSoul}
                      onChange={(event) => setSolverOptions((prev) => ({ ...prev, useHeartAndSoul: event.target.checked }))}
                      className="peer sr-only"
                    />
                    <span className="flex h-4 w-4 items-center justify-center rounded border border-slate-500/80 bg-slate-900/90 text-cyan-200 transition peer-checked:border-cyan-300 peer-checked:bg-cyan-500/20 peer-checked:shadow-[0_0_0_1px_rgba(34,211,238,0.35)]">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 opacity-0 transition peer-checked:opacity-100">
                        <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.414l-7.2 7.2a1 1 0 01-1.414 0l-3.2-3.2a1 1 0 111.414-1.414L8.8 11.786l6.493-6.496a1 1 0 011.411 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="transition group-hover:text-cyan-200">使用專心致志</span>
                  </label>
                  <label className="group flex w-full items-center gap-2 rounded-lg border border-purple-500/20 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-300 transition hover:border-cyan-400/40 hover:bg-slate-900/80">
                    <input
                      type="checkbox"
                      checked={solverOptions.useQuickInnovation}
                      onChange={(event) => setSolverOptions((prev) => ({ ...prev, useQuickInnovation: event.target.checked }))}
                      className="peer sr-only"
                    />
                    <span className="flex h-4 w-4 items-center justify-center rounded border border-slate-500/80 bg-slate-900/90 text-cyan-200 transition peer-checked:border-cyan-300 peer-checked:bg-cyan-500/20 peer-checked:shadow-[0_0_0_1px_rgba(34,211,238,0.35)]">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 opacity-0 transition peer-checked:opacity-100">
                        <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.414l-7.2 7.2a1 1 0 01-1.414 0l-3.2-3.2a1 1 0 111.414-1.414L8.8 11.786l6.493-6.496a1 1 0 011.411 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="transition group-hover:text-cyan-200">使用快速改革</span>
                  </label>
                  <label
                    className={`group flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition ${
                      trainedEyeEligible
                        ? 'border-purple-500/20 bg-slate-950/70 text-slate-300 hover:border-cyan-400/40 hover:bg-slate-900/80'
                        : 'border-slate-700/40 bg-slate-950/40 text-slate-500 cursor-not-allowed'
                    }`}
                    title={trainedEyeEligible ? '' : `需角色等級比配方高 10 級以上（目前：Lv.${crafterStats.level}，配方：Lv.${recipe?.lvl || '?'}）`}
                  >
                    <input
                      type="checkbox"
                      checked={solverOptions.useTrainedEye && trainedEyeEligible}
                      disabled={!trainedEyeEligible}
                      onChange={(event) => setSolverOptions((prev) => ({ ...prev, useTrainedEye: event.target.checked }))}
                      className="peer sr-only"
                    />
                    <span className="flex h-4 w-4 items-center justify-center rounded border border-slate-500/80 bg-slate-900/90 text-cyan-200 transition peer-checked:border-cyan-300 peer-checked:bg-cyan-500/20 peer-checked:shadow-[0_0_0_1px_rgba(34,211,238,0.35)] peer-disabled:opacity-40">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 opacity-0 transition peer-checked:opacity-100">
                        <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.414l-7.2 7.2a1 1 0 01-1.414 0l-3.2-3.2a1 1 0 111.414-1.414L8.8 11.786l6.493-6.496a1 1 0 011.411 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="transition group-hover:text-cyan-200">使用工匠的神速技巧</span>
                    {!trainedEyeEligible && <span className="ml-auto text-[10px] text-slate-600">等級不足</span>}
                  </label>
                  <label className="group flex w-full items-center gap-2 rounded-lg border border-purple-500/20 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-300 transition hover:border-cyan-400/40 hover:bg-slate-900/80">
                    <input
                      type="checkbox"
                      checked={solverOptions.backloadProgress}
                      disabled={solverOptions.targetQuality === 0}
                      onChange={(event) => {
                        const nextChecked = event.target.checked;
                        setSolverOptions((prev) => ({
                          ...prev,
                          backloadProgress: nextChecked,
                          targetQuality: nextChecked ? null : prev.targetQuality,
                        }));
                      }}
                      className="peer sr-only"
                    />
                    <span className="flex h-4 w-4 items-center justify-center rounded border border-slate-500/80 bg-slate-900/90 text-cyan-200 transition peer-checked:border-cyan-300 peer-checked:bg-cyan-500/20 peer-checked:shadow-[0_0_0_1px_rgba(34,211,238,0.35)]">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 opacity-0 transition peer-checked:opacity-100">
                        <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.414l-7.2 7.2a1 1 0 01-1.414 0l-3.2-3.2a1 1 0 111.414-1.414L8.8 11.786l6.493-6.496a1 1 0 011.411 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="transition group-hover:text-cyan-200">HQ優先</span>
                  </label>
                  <label className="group flex w-full items-center gap-2 rounded-lg border border-purple-500/20 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-300 transition hover:border-cyan-400/40 hover:bg-slate-900/80">
                    <input
                      type="checkbox"
                      checked={solverOptions.targetQuality === 0}
                      onChange={(event) => {
                        const nextChecked = event.target.checked;
                        setSolverOptions((prev) => ({
                          ...prev,
                          targetQuality: nextChecked ? 0 : null,
                          backloadProgress: nextChecked ? false : prev.backloadProgress,
                        }));
                      }}
                      className="peer sr-only"
                    />
                    <span className="flex h-4 w-4 items-center justify-center rounded border border-slate-500/80 bg-slate-900/90 text-cyan-200 transition peer-checked:border-cyan-300 peer-checked:bg-cyan-500/20 peer-checked:shadow-[0_0_0_1px_rgba(34,211,238,0.35)]">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 opacity-0 transition peer-checked:opacity-100">
                        <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.414l-7.2 7.2a1 1 0 01-1.414 0l-3.2-3.2a1 1 0 111.414-1.414L8.8 11.786l6.493-6.496a1 1 0 011.411 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="transition group-hover:text-cyan-200">NQ優先（無須品質）</span>
                  </label>
                </div>
              </div>
            )}

            {simulationMode === 'manual' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs sm:text-sm text-slate-400">點擊技能加入序列，點擊已加入技能可移除。</div>
                  <button
                    onClick={() => setManualActions([])}
                    className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-300 hover:border-amber-400/40"
                  >
                    清空手動序列
                  </button>
                </div>

                <div className="rounded-xl border border-purple-400/25 bg-slate-900/85 p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-slate-400">目前手動序列（{manualActions.length}）</span>
                    {activeBuffDurations.map((buff) => (
                      <span
                        key={buff.label}
                        className="rounded border border-cyan-500/25 bg-cyan-500/10 px-1.5 py-0.5 text-xs font-medium text-cyan-200"
                      >
                        {buff.label} {buff.value}
                      </span>
                    ))}
                  </div>
                  {manualActions.length === 0 ? (
                    <div className="text-sm text-slate-400">尚未加入技能</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {manualActions.map((action, index) => (
                        <button
                          key={`${action}-${index}`}
                          draggable={!MANUAL_ACTION_CATEGORIES.opening.includes(action)}
                          onDragStart={MANUAL_ACTION_CATEGORIES.opening.includes(action) ? undefined : () => setDraggedActionIndex(index)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => handleManualActionDrop(index)}
                          onClick={() => setManualActions((prev) => prev.filter((_, actionIndex) => actionIndex !== index))}
                          className="inline-flex items-center gap-2 rounded-lg border border-purple-500/20 bg-slate-900/80 px-2 py-1.5 text-xs text-slate-200 hover:border-red-400/40"
                          title={MANUAL_ACTION_CATEGORIES.opening.includes(action) ? '點擊移除此技能（起手技能無法重排）' : '可拖曳重排；點擊移除此技能'}
                        >
                          <span className="rounded-full bg-ffxiv-gold/10 px-1.5 py-0.5 text-[10px] text-ffxiv-gold">{index + 1}</span>
                          <img src={getCraftingActionIconUrl(action)} alt={formatActionName(action)} className="h-4 w-4 object-contain" loading="lazy" />
                          <span>{formatActionName(action)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {manualRunError && (
                  <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-3 py-2 text-xs sm:text-sm text-red-300">
                    {manualRunError}
                  </div>
                )}

                {isComplete && !hasFailure && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
                    製作完成{isQualityMax ? '，物品已達最高品質。' : '。'}
                  </div>
                )}

                {hasFailure && (
                  <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                    耐久耗盡，製作失敗。所有技能已鎖定，請清空序列重新開始。
                  </div>
                )}

                <div className="space-y-3">
                  {Object.entries(MANUAL_ACTION_CATEGORIES).map(([category, actions]) => (
                    <div key={category} className="rounded-xl border border-purple-400/25 bg-slate-900/82 p-3">
                      <div className="mb-2 text-xs sm:text-sm font-semibold text-slate-300">{MANUAL_CATEGORY_NAMES[category] || category}</div>
                      <div className="flex flex-wrap gap-2">
                        {actions.map((action) => {
                          const isAllowed = allowedActionMap[action] ?? true;
                          const cpCost = toFiniteNumber(actionCpMap[action], 0);
                          const durabilityCost = toFiniteNumber(actionDurabilityCostMap[action], 0);
                          const currentCp = toFiniteNumber(manualStatus?.craft_points, 0);
                          const currentDurability = toFiniteNumber(manualStatus?.durability, 0);
                          const isInsufficientCp = cpCost > 0 && currentCp < cpCost;
                          const isInsufficientDurability = durabilityCost > 0 && currentDurability < durabilityCost;
                          const requiredLevel = ACTION_LEVEL_REQUIREMENTS[action] || 1;
                          const isInsufficientLevel = crafterStats.level < requiredLevel;
                          const isUnsimulatable = UNSIMULATABLE_ACTIONS.includes(action);
                          const isExecutable = actionExecutableMap[action] ?? true;
                          const isNotExecutable = !isExecutable;
                          const isOpeningOnly = MANUAL_ACTION_CATEGORIES.opening.includes(action) && manualActions.length > 0;
                          const isActionDisabled = !manualStatus || !isAllowed || isLoadingActionMeta || isInsufficientCp || isInsufficientDurability || isInsufficientLevel || isComplete || hasFailure || isOpeningOnly || isUnsimulatable || isNotExecutable;
                          return (
                            <button
                              key={action}
                              disabled={isActionDisabled}
                              onClick={() => {
                                handleAddManualAction(action);
                              }}
                              className={`relative flex w-[86px] flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[10px] transition ${isActionDisabled ? 'border-slate-700/80 bg-slate-900/45 text-slate-600 cursor-not-allowed opacity-55 grayscale saturate-0 shadow-none' : 'border-cyan-500/25 bg-slate-900/80 text-slate-200 hover:border-cyan-400/45 hover:text-cyan-200 hover:shadow-[0_0_10px_rgba(34,211,238,0.15)]'}`}
                              title={`${formatActionName(action)}，Lv.${requiredLevel}${cpCost ? ` (${cpCost} CP)` : ''}${isInsufficientLevel ? `（目前：Lv.${crafterStats.level}，等級不足）` : ''}${isInsufficientCp ? ` — CP 不足（需 ${cpCost}，剩餘 ${currentCp}）` : ''}${(isUnsimulatable || isNotExecutable) ? ' — 無法模擬該技能' : ''}${isOpeningOnly ? ' — 起手技能僅可用於第一步' : ''}`}
                            >
                              <img src={getCraftingActionIconUrl(action)} alt={formatActionName(action)} className="h-8 w-8 object-contain" loading="lazy" />
                              <span className="truncate max-w-full">{formatActionName(action)}</span>
                              {cpCost > 0 && (
                                <span className="absolute -top-1 -right-1 rounded bg-pink-600 px-1 text-[9px] text-white">{cpCost}</span>
                              )}

                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {simulationResult && finalStatus && (
            <>
              {isComplete && !hasFailure && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
                  製作完成{isQualityMax ? '，物品已達最高品質。' : '。'}
                </div>
              )}

              {hasFailure && (
                <div className="rounded-2xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                  模擬結果耐久耗盡，這組預設屬性無法穩定完成此配方。
                </div>
              )}

              {firstError && !hasFailure && simulationMode === 'auto' && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
                  第 {firstError.pos + 1} 步出現警告：{localizeSimulationErrorMessage(firstError.err) || firstError.err}
                </div>
              )}

              {simulationMode === 'auto' && (
              <div className="rounded-2xl border border-purple-400/30 bg-slate-800/75 p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-white">結果詳情</h3>
                    {!(rightPanelTab === 'rotation' && simulationMode === 'manual') && (
                      <p className="text-xs sm:text-sm text-slate-400">
                        {rightPanelTab === 'rotation'
                          ? '以下為自動求解後的實際出手順序。'
                          : '逐步顯示每次出手後的狀態變化。'}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs sm:text-sm">
                      <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-blue-300">總步數 {activeActions.length}</span>
                      <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-orange-300">HQ 機率 {formatPercent(simulationResult.hqProbability)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-xl border border-purple-500/25 bg-slate-950/70 p-1">
                      <button
                        onClick={() => setRightPanelTab('rotation')}
                        className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg transition ${rightPanelTab === 'rotation' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'}`}
                      >
                        技能序列
                      </button>
                      <button
                        onClick={() => setRightPanelTab('timeline')}
                        disabled={simulationMode !== 'auto' || detailedStatuses.length === 0}
                        className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg transition ${rightPanelTab === 'timeline' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'} ${simulationMode !== 'auto' || detailedStatuses.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        步驟推演
                      </button>
                    </div>
                  </div>
                </div>

                {rightPanelTab === 'rotation' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-h-[52vh] overflow-y-auto pr-1">
                    {activeActions.map((action, index) => (
                      <div
                        key={`${action}-${index}`}
                        className={`group rounded-xl border px-3 py-2.5 transition hover:border-ffxiv-gold/35 hover:shadow-[0_0_16px_rgba(168,85,247,0.12)] ${activeErrorPositions.has(index) ? 'border-amber-500/30 bg-gradient-to-r from-amber-950/35 via-slate-800/85 to-slate-900/95' : 'border-purple-500/15 bg-gradient-to-r from-slate-900/95 via-slate-800/85 to-slate-900/95'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-cyan-400/30 bg-cyan-500/10">
                            <img
                              src={getCraftingActionIconUrl(action)}
                              alt={formatActionName(action)}
                              className="h-8 w-8 object-contain"
                              loading="lazy"
                            />
                          </div>
                          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-ffxiv-gold/25 bg-ffxiv-gold/10 text-xs font-bold text-ffxiv-gold">
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-100">{formatActionName(action)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {rightPanelTab === 'timeline' && simulationMode === 'auto' && detailedStatuses.length > 0 && (
                  <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-1">
                    {detailedStatuses.map((statusPayload, index) => {
                      const action = simulationResult.actions[index];
                      const currentStatus = normalizeStatusSnapshot(statusPayload);
                      const previousPayload = index === 0 ? simulationResult.initialStatus : detailedStatuses[index - 1];
                      const previousStatus = normalizeStatusSnapshot(previousPayload);
                      const conditionClass = CONDITION_BADGE_CLASSES[currentStatus?.condition] || CONDITION_BADGE_CLASSES.Normal;

                      const currentProgress = toFiniteNumber(currentStatus?.progress, 0);
                      const currentQuality = toFiniteNumber(currentStatus?.quality, 0);
                      const currentDurability = toFiniteNumber(currentStatus?.durability, 0);
                      const currentCp = toFiniteNumber(currentStatus?.craft_points, 0);
                      const previousProgress = toFiniteNumber(previousStatus?.progress, 0);
                      const previousQuality = toFiniteNumber(previousStatus?.quality, 0);
                      const previousDurability = toFiniteNumber(previousStatus?.durability, 0);
                      const previousCp = toFiniteNumber(previousStatus?.craft_points, 0);
                      const progressDelta = currentProgress - previousProgress;
                      const qualityDelta = currentQuality - previousQuality;
                      const durabilityDelta = currentDurability - previousDurability;
                      const cpDelta = currentCp - previousCp;

                      return (
                        <div
                          key={`detail-${index}`}
                          className={`rounded-xl border px-3 py-3 ${errorPositions.has(index) ? 'border-amber-500/30 bg-amber-950/20' : 'border-purple-500/15 bg-slate-950/50'}`}
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-cyan-400/30 bg-cyan-500/10">
                                <img
                                  src={getCraftingActionIconUrl(action)}
                                  alt={formatActionName(action)}
                                  className="h-8 w-8 object-contain"
                                  loading="lazy"
                                />
                              </div>
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ffxiv-gold/25 bg-ffxiv-gold/10 text-xs font-bold text-ffxiv-gold">
                                {index + 1}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-slate-100">{formatActionName(action)}</div>
                              </div>
                            </div>
                            <div className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-medium ${conditionClass}`}>
                              {formatConditionName(currentStatus?.condition)}
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-2 xl:grid-cols-4 gap-2 text-xs sm:text-sm">
                            <div className="rounded-lg bg-slate-900/70 px-3 py-2">
                              <div className="text-slate-500">進展</div>
                              <div className={`mt-1 font-semibold ${getDeltaColorClass(progressDelta)}`}>{formatDeltaOrUnchanged(progressDelta)}</div>
                              <div className="text-[11px] text-slate-500">目前 {Math.round(currentProgress)}</div>
                            </div>
                            <div className="rounded-lg bg-slate-900/70 px-3 py-2">
                              <div className="text-slate-500">品質</div>
                              <div className={`mt-1 font-semibold ${getDeltaColorClass(qualityDelta)}`}>{formatDeltaOrUnchanged(qualityDelta)}</div>
                              <div className="text-[11px] text-slate-500">目前 {Math.round(currentQuality)}</div>
                            </div>
                            <div className="rounded-lg bg-slate-900/70 px-3 py-2">
                              <div className="text-slate-500">耐久</div>
                              <div className={`mt-1 font-semibold ${getDeltaColorClass(durabilityDelta)}`}>{formatResourceDelta(durabilityDelta)}</div>
                              <div className="text-[11px] text-slate-500">目前 {Math.round(currentDurability)}（{formatDeltaOrUnchanged(durabilityDelta)}）</div>
                            </div>
                            <div className="rounded-lg bg-slate-900/70 px-3 py-2">
                              <div className="text-slate-500">CP</div>
                              <div className={`mt-1 font-semibold ${getDeltaColorClass(cpDelta)}`}>{formatResourceDelta(cpDelta)}</div>
                              <div className="text-[11px] text-slate-500">目前 {Math.round(currentCp)}（{formatDeltaOrUnchanged(cpDelta)}）</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {rightPanelTab === 'timeline' && (simulationMode !== 'auto' || detailedStatuses.length === 0) && (
                  <div className="rounded-xl border border-purple-500/20 bg-slate-900/60 px-4 py-5 text-center text-sm text-slate-400">
                    步驟推演目前僅在自動模式且有推演資料時可查看。
                  </div>
                )}
              </div>
              )}
            </>
          )}

          {simulationMode === 'auto' && !loadingRecipe && !runningSolver && (!simulationResult || needsSolve) && (
            <div className="rounded-2xl border border-purple-400/25 bg-slate-800/70 px-4 py-6 text-center text-sm">
              <div className="text-slate-400">尚未產生模擬結果</div>
              <button
                type="button"
                onClick={handleStartSolve}
                disabled={!recipe || runningSolver}
                className="mt-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:border-cyan-400/50 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                開始解析
              </button>
            </div>
          )}

            </div>

            <div className="space-y-3 xl:sticky xl:top-0 self-start">

          <div className="rounded-2xl border border-purple-400/30 bg-slate-800/75 p-3.5 sm:p-4">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <h3 className="text-base sm:text-lg font-semibold text-white">HQ材料設定</h3>
              <div className="rounded-full border border-orange-500/25 bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold text-orange-300">
                初始品質 {Math.round(clampedStartingQuality)} / {Math.round(recipe?.quality || 0)}
              </div>
            </div>

            {ingredientsLoading ? (
              <div className="text-sm text-slate-400">載入材料中...</div>
            ) : ingredients.filter((ingredient) => Number(ingredient.quality) > 0).length > 0 ? (
              <div className="space-y-1 max-h-[30vh] overflow-y-auto pr-1">
                {ingredients.filter((ingredient) => Number(ingredient.quality) > 0).map((ingredient) => {
                  const ingredientHqCount = ingredientHqCounts[ingredient.key] || 0;
                  const maxAmount = Math.max(0, Math.floor(ingredient.amount || 0));

                  return (
                    <div key={ingredient.key} className="rounded-lg border border-purple-500/15 bg-slate-950/55 px-2 py-1">
                      <div className="flex items-center gap-2">
                        <div className="relative rounded-md border border-white/10 bg-slate-900/70 p-1">
                          <ItemImage itemId={ingredient.id} alt={ingredient.name} className="h-6 w-6 object-contain" priority />
                          <div className="absolute -bottom-1 -right-1 rounded-full border border-ffxiv-gold/40 bg-ffxiv-gold/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-ffxiv-gold">
                            ×{ingredient.amount}
                          </div>
                        </div>
                        <a
                          href={`${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}${generateItemUrl(ingredient.id, ingredient.name)}`}
                          className="min-w-0 flex-1 truncate text-xs font-medium text-slate-100 hover:text-cyan-200"
                        >
                          {ingredient.name}
                        </a>
                        <div className="ml-1 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleIngredientHqChange(ingredient.key, maxAmount, ingredientHqCount - 1)}
                            className="h-5 w-5 rounded-md border border-purple-500/25 bg-slate-950/80 text-xs text-slate-200 hover:border-purple-400/50"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={maxAmount}
                            value={ingredientHqCount}
                            onChange={(event) => handleIngredientHqChange(ingredient.key, maxAmount, event.target.value)}
                            className="w-12 rounded-md border border-purple-500/25 bg-slate-950/80 px-1 py-0.5 text-center text-xs font-semibold text-slate-100 outline-none focus:border-purple-300/70 [appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
                          />
                          <span className="text-[11px] text-slate-500">/ {maxAmount}</span>
                          <button
                            type="button"
                            onClick={() => handleIngredientHqChange(ingredient.key, maxAmount, ingredientHqCount + 1)}
                            className="h-5 w-5 rounded-md border border-purple-500/25 bg-slate-950/80 text-xs text-slate-200 hover:border-purple-400/50"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-slate-400">此配方沒有可設定 HQ 的材料。</div>
            )}
          </div>

          <div className="rounded-2xl border border-purple-400/30 bg-slate-800/75 p-3.5 sm:p-4">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-white">巨集</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyMacro}
                    className="inline-flex min-w-[58px] flex-col items-center justify-center rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold leading-tight text-cyan-300 transition hover:border-cyan-400/40 hover:text-cyan-200"
                >
                    {copyState === 'copied' ? (
                      <>
                        <span>已複製</span>
                        <span>本頁</span>
                      </>
                    ) : copyState === 'failed' ? (
                      <>
                        <span>複製</span>
                        <span>失敗</span>
                      </>
                    ) : (
                      <>
                        <span>複製</span>
                        <span>本頁</span>
                      </>
                    )}
                </button>
              </div>
            </div>
            {macroPreviewLines.length > 0 ? (
              <div className="space-y-2.5">
                {activeMacroPages.length > 1 && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-purple-500/20 bg-slate-950/55 px-2.5 py-2">
                    <button
                      type="button"
                      onClick={() => setMacroPageIndex((previous) => Math.max(previous - 1, 0))}
                      disabled={macroPageIndex === 0}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/25 bg-gradient-to-r from-slate-900/95 via-slate-800/85 to-slate-900/95 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:border-cyan-400/45 hover:text-cyan-200 hover:shadow-[0_0_14px_rgba(34,211,238,0.12)] disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <span aria-hidden="true">←</span>
                      <span>上一頁</span>
                    </button>
                    <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-200">
                      第 {macroPageIndex + 1} / {activeMacroPages.length} 頁
                    </div>
                    <button
                      type="button"
                      onClick={() => setMacroPageIndex((previous) => Math.min(previous + 1, activeMacroPages.length - 1))}
                      disabled={macroPageIndex >= activeMacroPages.length - 1}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/25 bg-gradient-to-r from-slate-900/95 via-slate-800/85 to-slate-900/95 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:border-cyan-400/45 hover:text-cyan-200 hover:shadow-[0_0_14px_rgba(34,211,238,0.12)] disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <span>下一頁</span>
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                )}

                <div className="max-h-[34vh] overflow-y-auto rounded-lg border border-purple-500/20 bg-slate-950/70 text-[11px] leading-5">
                  {macroPreviewLines.map((line, index) => (
                    <div key={`macro-line-${index}`} className="grid grid-cols-[34px_1fr] gap-0 border-b border-white/5 last:border-b-0">
                      <div className="select-none px-2 py-1 text-right text-slate-500 bg-slate-900/35">{index + 1}</div>
                      <div className="select-text px-2 py-1 text-slate-200 whitespace-pre-wrap break-words">{line}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-purple-500/20 bg-slate-950/60 px-3 py-3 text-xs text-slate-400">
                尚無可顯示的巨集內容。
              </div>
            )}
          </div>

          {(loadingRecipe || runningSolver) && (
            <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-slate-900/80 via-purple-950/20 to-slate-900/80 px-5 py-8 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-purple-400/20 border-t-ffxiv-gold" />
              <div className="mt-4 text-base font-semibold text-ffxiv-gold">
                {loadingRecipe ? '讀取配方資料中...' : '正在計算最佳手法...'}
              </div>
              <div className="mt-1 text-sm text-slate-400">高等級物品複雜度較高，會需要更多時間計算。</div>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}