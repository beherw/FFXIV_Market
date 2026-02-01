/**
 * Normalize timestamp to seconds (handles both seconds and milliseconds)
 * @param {number} timestamp - Unix timestamp (could be in seconds or milliseconds)
 * @returns {number} - Timestamp in seconds
 */
function normalizeTimestamp(timestamp) {
  if (!timestamp) return null;
  
  // If timestamp is larger than a reasonable date in seconds (year 2100), it's likely in milliseconds
  // Year 2100 in seconds: 4102444800
  // Current time in seconds: ~1700000000
  // So if timestamp > 10000000000, it's likely milliseconds
  if (timestamp > 10000000000) {
    // It's in milliseconds, convert to seconds
    return Math.floor(timestamp / 1000);
  }
  // It's already in seconds
  return timestamp;
}

/**
 * Format relative time (e.g., "2 minutes ago", "3 hours ago")
 * Always shows specific time, never vague terms like "剛剛"
 * Uses browser's local time for calculation
 * @param {number} timestamp - Unix timestamp (seconds or milliseconds)
 * @returns {string} - Formatted relative time string
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return '未知';
  
  const normalizedTimestamp = normalizeTimestamp(timestamp);
  if (!normalizedTimestamp) return '未知';
  
  const now = Math.floor(Date.now() / 1000);
  const diff = now - normalizedTimestamp;
  
  if (diff < 0) return '0分鐘前';
  if (diff < 60) return '1分鐘前';
  if (diff < 3600) {
    const minutes = Math.floor(diff / 60);
    return `${minutes}分鐘前`;
  }
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    return minutes > 0 ? `${hours}小時${minutes}分鐘前` : `${hours}小時前`;
  }
  if (diff < 604800) {
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    return hours > 0 ? `${days}天${hours}小時前` : `${days}天前`;
  }
  const weeks = Math.floor(diff / 604800);
  const days = Math.floor((diff % 604800) / 86400);
  return days > 0 ? `${weeks}週${days}天前` : `${weeks}週前`;
}

/**
 * Format timestamp to user's browser local time
 * @param {number} timestamp - Unix timestamp (seconds or milliseconds)
 * @returns {string} - Formatted time string in user's local timezone
 */
export function formatLocalTime(timestamp) {
  if (!timestamp) return '未知';
  
  const normalizedTimestamp = normalizeTimestamp(timestamp);
  if (!normalizedTimestamp) return '未知';
  
  const date = new Date(normalizedTimestamp * 1000);
  
  // Format using browser's local timezone
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  // Get timezone offset
  const timezoneOffset = -date.getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(timezoneOffset) / 60);
  const offsetMinutes = Math.abs(timezoneOffset) % 60;
  const offsetSign = timezoneOffset >= 0 ? '+' : '-';
  const offsetString = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
  
  // Get timezone name if available
  const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  return `${year}-${month}-${day} ${hours}:${minutes} ${timezoneName} ${offsetString}`;
}

/**
 * Format timestamp for tooltip display: clean date, time, and timezone on separate lines
 * @param {number} timestamp - Unix timestamp (seconds or milliseconds)
 * @returns {{ dateStr: string, timeStr: string, tzStr: string } | null}
 */
export function formatLocalTimeForTooltip(timestamp) {
  if (!timestamp) return null;

  const normalizedTimestamp = normalizeTimestamp(timestamp);
  if (!normalizedTimestamp) return null;

  const date = new Date(normalizedTimestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return {
    dateStr: `${year}/${month}/${day}`,
    timeStr: `${hours}:${minutes}`,
    tzStr: timezoneName,
  };
}
