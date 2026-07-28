import { useEffect, useState } from 'react';
import { BUILD_DATE, GAME_VERSION } from '../constants/version';

const DATA_TAGS_API = 'https://api.github.com/repos/harukaxxxx/ffxiv-datamining-tw/tags?per_page=100';
const REPORT_URL = 'https://forum.gamer.com.tw/C.php?bsn=17608&snA=28740';

function parsePatchVersion(tagName) {
  const match = /^patch-(\d+(?:\.\d+)*)$/i.exec(tagName);
  return match?.[1] ?? null;
}

function compareVersions(a, b) {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  const length = Math.max(aParts.length, bParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (aParts[index] ?? 0) - (bParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function formatBuildDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Taipei',
  }).format(date);
}

export default function GameVersionBadge() {
  const [liveVersion, setLiveVersion] = useState(null);
  const isOutdated = liveVersion && compareVersions(GAME_VERSION, liveVersion) < 0;

  useEffect(() => {
    const controller = new AbortController();

    fetch(DATA_TAGS_API, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((tags) => {
        const newest = tags
          .map(({ name }) => parsePatchVersion(name))
          .filter(Boolean)
          .sort(compareVersions)
          .at(-1);
        if (newest) setLiveVersion(newest);
      })
      .catch(() => {
        // Version checking is informational; never disrupt normal use.
      });

    return () => controller.abort();
  }, []);

  return (
    <div className={`game-version ${isOutdated ? 'game-version-outdated' : ''}`}>
      <span className="game-version-badge" tabIndex="0" aria-describedby="game-version-details">
        <span className="game-version-label">資料版本</span>
        <span className="game-version-number">{GAME_VERSION}</span>
        {isOutdated && <span className="game-version-alert" aria-label="有新版本可用">!</span>}
      </span>
      <div id="game-version-details" className="game-version-details" role="tooltip">
        <p>更新於 {formatBuildDate(BUILD_DATE)}</p>
        {isOutdated && (
          <p className="game-version-warning">
            遊戲目前為 {liveVersion}，本站資料尚未更新。請協助通知作者。
          </p>
        )}
        {isOutdated && (
          <a href={REPORT_URL} target="_blank" rel="noopener noreferrer" className="game-version-report-link">
            前往巴哈姆特回報
          </a>
        )}
      </div>
    </div>
  );
}
