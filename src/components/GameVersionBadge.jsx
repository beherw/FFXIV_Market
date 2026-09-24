import { BUILD_DATE, GAME_VERSION } from '../constants/version';

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
  return (
    <div className="game-version">
      <span className="game-version-badge" tabIndex="0" aria-describedby="game-version-details">
        <span className="game-version-prefix">版本：</span>
        <span className="game-version-number">{GAME_VERSION}</span>
      </span>
      <div id="game-version-details" className="game-version-details" role="tooltip">
        <p>更新於 {formatBuildDate(BUILD_DATE)}</p>
      </div>
    </div>
  );
}
