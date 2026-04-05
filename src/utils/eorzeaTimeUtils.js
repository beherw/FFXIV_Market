/**
 * Eorzea time helpers for obtainable methods (gathering node spawn times).
 * 1 Eorzea day = 70 real minutes.
 */

const EORZEA_TIME_RATIO = 3600 / 175;
const EORZEA_MINUTES_PER_DAY = 24 * 60;

/** One Eorzea day = 70 real-world minutes → milliseconds per one Eorzea minute */
export const REAL_MS_PER_EORZEA_MINUTE = (70 * 60 * 1000) / EORZEA_MINUTES_PER_DAY;

export function eorzeaMinutesToRealMs(eorzeaMinutes) {
  if (!Number.isFinite(eorzeaMinutes)) return 0;
  return Math.max(0, eorzeaMinutes * REAL_MS_PER_EORZEA_MINUTE);
}

function getDefaultLocale() {
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
  return 'en-US';
}

function isChineseLocale(locale) {
  return /^zh/i.test(locale || '');
}

/**
 * Human-readable real-world duration from an Eorzea-minute span (spawn timers use ET minutes).
 */
export function formatHumanDurationFromEorzeaMinutes(eorzeaMinutes, locale = getDefaultLocale()) {
  const ms = eorzeaMinutesToRealMs(eorzeaMinutes);
  if (ms > 0 && ms < 1000) {
    return isChineseLocale(locale) ? '不到 1 秒' : '< 1 s';
  }
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (isChineseLocale(locale)) {
    const parts = [];
    if (hours > 0) parts.push(`${hours} 小時`);
    if (minutes > 0) parts.push(`${minutes} 分`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds} 秒`);
    return parts.join(' ');
  }

  if (typeof Intl !== 'undefined' && typeof Intl.DurationFormat === 'function') {
    try {
      return new Intl.DurationFormat(locale, { style: 'narrow', numeric: 'always' }).format({
        hours,
        minutes,
        seconds
      });
    } catch {
      // fall through
    }
  }

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

/**
 * Local wall-clock time when an event `eorzeaMinutesFromNow` Eorzea minutes away will occur (uses browser timezone).
 */
export function formatLocalTimeAfterEorzeaMinutes(eorzeaMinutesFromNow, nowMs = Date.now()) {
  if (!Number.isFinite(eorzeaMinutesFromNow)) return '—';
  const when = new Date(nowMs + eorzeaMinutesToRealMs(eorzeaMinutesFromNow));
  const now = new Date(nowMs);
  const locale = getDefaultLocale();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startThatDay = new Date(when.getFullYear(), when.getMonth(), when.getDate()).getTime();
  const sameCalendarDay = startToday === startThatDay;
  const timeOpts = { hour: 'numeric', minute: '2-digit', second: '2-digit' };
  if (sameCalendarDay) {
    return when.toLocaleTimeString(locale, timeOpts);
  }
  return when.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'medium' });
}

export function getEorzeaTime(earthMs) {
  const eorzeaMs = earthMs * EORZEA_TIME_RATIO;
  const eorzeaDate = new Date(eorzeaMs);
  const hours = eorzeaDate.getUTCHours();
  const minutes = eorzeaDate.getUTCMinutes();
  const seconds = eorzeaDate.getUTCSeconds();
  const totalMinutes = hours * 60 + minutes + seconds / 60;
  return { hours, minutes, seconds, totalMinutes };
}

export function formatEorzeaDuration(minutes) {
  if (!Number.isFinite(minutes)) return '--:--';
  const totalSeconds = Math.max(0, Math.floor(minutes * 60));
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatEorzeaTimeOfDay(totalMinutes) {
  if (!Number.isFinite(totalMinutes)) return '--:--';
  const normalized = ((Math.floor(totalMinutes) % EORZEA_MINUTES_PER_DAY) + EORZEA_MINUTES_PER_DAY) % EORZEA_MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Teamcraft-equivalent "second next" spawn (alarm-status.service getSimpleAlarmStatus):
 * first window start strictly AFTER (nextSpawnStart + duration), where nextSpawnStart is from
 * getLimitedNodeTiming. Not the 2nd chronological spawn after "now" — e.g. while spawned in the
 * 4:00 ET window, this is the next start after that window ends (e.g. 16:00), not tomorrow 4:00.
 */
export function getEorzeaMinutesUntilSecondNextSpawn(spawns, durationMinutes, currentMinutes, timing) {
  if (
    !timing ||
    !Array.isArray(spawns) ||
    spawns.length === 0 ||
    !Number.isFinite(durationMinutes) ||
    durationMinutes <= 0 ||
    !Number.isFinite(currentMinutes)
  ) {
    return null;
  }

  const spawnStarts = [...new Set(
    spawns
      .map(h => Number(h))
      .filter(h => Number.isFinite(h))
      .map(h => {
        const hAbs = ((h % 24) + 24) % 24;
        const whole = Math.floor(hAbs);
        const mins = Math.floor((hAbs - whole) * 60);
        return whole * 60 + mins;
      })
  )].sort((a, b) => a - b);

  if (spawnStarts.length === 0) return null;

  const windowEnd = timing.nextSpawnStart + durationMinutes;

  const candidates = [];
  for (let day = 0; day <= 8; day++) {
    for (const start of spawnStarts) {
      const t = day * EORZEA_MINUTES_PER_DAY + start;
      if (t > windowEnd) {
        candidates.push(t);
      }
    }
  }
  candidates.sort((a, b) => a - b);
  if (candidates.length === 0) return null;

  return candidates[0] - currentMinutes;
}

/**
 * Progress [0,1] from window end → second-next spawn (Teamcraft-style).
 */
export function getSecondNextSpawnProgress(currentMinutes, windowEndAbsolute, secondNextSpawnAbsolute) {
  if (
    !Number.isFinite(currentMinutes) ||
    !Number.isFinite(windowEndAbsolute) ||
    !Number.isFinite(secondNextSpawnAbsolute) ||
    secondNextSpawnAbsolute <= windowEndAbsolute
  ) {
    return 0;
  }
  if (currentMinutes <= windowEndAbsolute) {
    return 0;
  }
  return Math.min(1, Math.max(0, (currentMinutes - windowEndAbsolute) / (secondNextSpawnAbsolute - windowEndAbsolute)));
}

/**
 * Eorzea minutes from now until the Nth upcoming gathering window start (1 = next spawn, 2 = after that).
 * Uses the same spawn-hour list as limited nodes; each spawn repeats every Eorzea day.
 */
export function getEorzeaMinutesUntilNthSpawnStart(spawns, currentMinutes, n) {
  if (!Array.isArray(spawns) || spawns.length === 0 || !Number.isFinite(currentMinutes) || !Number.isFinite(n) || n < 1) {
    return null;
  }

  const spawnStarts = [...new Set(
    spawns
      .map(hour => Number(hour))
      .filter(hour => Number.isFinite(hour))
      .map(hour => ((hour % 24) + 24) % 24)
  )]
    .sort((a, b) => a - b)
    .map(hour => hour * 60);

  if (spawnStarts.length === 0) return null;

  const candidates = [];
  for (let day = 0; day <= 4; day++) {
    for (const start of spawnStarts) {
      const t = day * EORZEA_MINUTES_PER_DAY + start;
      if (t > currentMinutes) {
        candidates.push(t);
      }
    }
  }
  candidates.sort((a, b) => a - b);
  const idx = n - 1;
  if (idx >= candidates.length) return null;
  return candidates[idx] - currentMinutes;
}

/**
 * Get spawn/downtime timing for a limited node.
 * @param {Array<number>} spawns - Eorzea hours when node spawns
 * @param {number} durationMinutes - Duration in Eorzea minutes
 * @param {number} currentMinutes - Current Eorzea time in minutes
 * @returns {{ state: 'spawned'|'waiting', remainingMinutes: number, totalMinutes: number, nextSpawnStart: number, progress: number } | null}
 */
export function getLimitedNodeTiming(spawns, durationMinutes, currentMinutes) {
  if (!Array.isArray(spawns) || spawns.length === 0 || !Number.isFinite(durationMinutes) || durationMinutes <= 0 || !Number.isFinite(currentMinutes)) {
    return null;
  }

  const spawnStarts = spawns
    .map(hour => Number(hour))
    .filter(hour => Number.isFinite(hour))
    .map(hour => ((hour % 24) + 24) % 24)
    .sort((a, b) => a - b)
    .map(hour => hour * 60);

  if (spawnStarts.length === 0) return null;

  const minutesInDay = EORZEA_MINUTES_PER_DAY;

  for (const start of spawnStarts) {
    const end = start + durationMinutes;
    if (end <= minutesInDay) {
      if (currentMinutes >= start && currentMinutes < end) {
        const remaining = end - currentMinutes;
        return {
          state: 'spawned',
          remainingMinutes: remaining,
          totalMinutes: durationMinutes,
          nextSpawnStart: start,
          progress: Math.min(1, Math.max(0, (durationMinutes - remaining) / durationMinutes))
        };
      }
    } else {
      const endWrapped = end - minutesInDay;
      if (currentMinutes >= start || currentMinutes < endWrapped) {
        const remaining = currentMinutes >= start
          ? minutesInDay - currentMinutes + endWrapped
          : endWrapped - currentMinutes;
        return {
          state: 'spawned',
          remainingMinutes: remaining,
          totalMinutes: durationMinutes,
          nextSpawnStart: start,
          progress: Math.min(1, Math.max(0, (durationMinutes - remaining) / durationMinutes))
        };
      }
    }
  }

  let nextStart = null;
  for (const start of spawnStarts) {
    if (start > currentMinutes) {
      nextStart = start;
      break;
    }
  }
  if (nextStart === null) {
    nextStart = spawnStarts[0] + minutesInDay;
  }

  let prevStart = null;
  for (let i = spawnStarts.length - 1; i >= 0; i -= 1) {
    if (spawnStarts[i] <= currentMinutes) {
      prevStart = spawnStarts[i];
      break;
    }
  }
  if (prevStart === null) {
    prevStart = spawnStarts[spawnStarts.length - 1] - minutesInDay;
  }

  const prevEnd = prevStart + durationMinutes;
  const downtimeTotal = Math.max(1, nextStart - prevEnd);
  const remaining = Math.max(0, nextStart - currentMinutes);

  return {
    state: 'waiting',
    remainingMinutes: remaining,
    totalMinutes: downtimeTotal,
    nextSpawnStart: nextStart,
    progress: Math.min(1, Math.max(0, 1 - remaining / downtimeTotal))
  };
}
