/**
 * Eorzea time helpers for obtainable methods (gathering node spawn times).
 * 1 Eorzea day = 70 real minutes.
 */

const EORZEA_TIME_RATIO = 3600 / 175;
const EORZEA_MINUTES_PER_DAY = 24 * 60;

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
