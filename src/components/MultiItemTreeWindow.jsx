// Standalone page for the multi-item combined tree, opened in its own browser tab so it isn't
// limited by a modal's size and can't be closed by a stray click outside it.
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import MultiItemCombinedTree from './MultiItemCombinedTree';
import { getValidatedCache } from '../utils/cacheStorage.js';
import { MULTI_ITEM_STORAGE_KEY } from '../hooks/useMultiItemCombinedTree';
import bundledServers from '../constants/universalisServers.json';
import { SELECT_ITEM_MESSAGE } from '../constants/multiItemTreeWindow.js';

const SERVER_CACHE_KEY = 'universalis-servers-v1';

function readBuiltTree() {
  const data = getValidatedCache(MULTI_ITEM_STORAGE_KEY);
  return data?.builtTree?.length > 0 ? data.builtTree : null;
}

function readServers() {
  try {
    const cached = JSON.parse(localStorage.getItem(SERVER_CACHE_KEY) || 'null');
    if (cached?.dataCenters && cached?.worlds) return cached;
  } catch {
    // fall through to bundled list
  }
  return bundledServers;
}

export default function MultiItemTreeWindow() {
  const [searchParams] = useSearchParams();
  const [builtTree, setBuiltTree] = useState(readBuiltTree);
  const [excludeCrystals] = useState(() => localStorage.getItem('craftingTreeExcludeCrystals') !== 'false');

  useEffect(() => {
    document.title = '多物品組合樹｜FFXIV Market';
  }, []);

  // Follow rebuilds from the main window. An edited-but-not-rebuilt list clears the stored tree;
  // keep showing the last tree until a new one is built.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== MULTI_ITEM_STORAGE_KEY) return;
      const next = readBuiltTree();
      if (next) setBuiltTree(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const { worlds, selectedWorld, selectedServerOption } = useMemo(() => {
    const servers = readServers();
    const worldsMap = {};
    servers.worlds.forEach(w => { worldsMap[w.id] = w.name; });

    const serverParam = searchParams.get('server');
    const dcParam = searchParams.get('dc');
    const tradChineseDCs = servers.dataCenters.filter(dc => dc.region && dc.region.startsWith('繁中服'));
    const dc = servers.dataCenters.find(d => d.name === dcParam)
      || tradChineseDCs.find(d => d.worlds?.length > 0)
      || servers.dataCenters.find(d => d.worlds?.length > 0);
    const option = serverParam
      ? (/^\d+$/.test(serverParam) ? Number(serverParam) : serverParam)
      : dc?.name;

    return {
      worlds: worldsMap,
      selectedWorld: dc ? { region: dc.region || '', section: dc.name, apiName: dc.name, world: dc.worlds[0], dcObj: dc } : null,
      selectedServerOption: option || null,
    };
  }, [searchParams]);

  // Clicking an item shows it in the main window when it's still open; otherwise in a new tab
  const handleItemSelect = useCallback((item) => {
    const opener = window.opener;
    if (opener && !opener.closed) {
      try {
        opener.postMessage({ type: SELECT_ITEM_MESSAGE, itemId: item.id }, window.location.origin);
        opener.focus();
        return true;
      } catch {
        // opener navigated elsewhere; fall back to a new tab
      }
    }
    return false;
  }, []);

  if (!builtTree) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-gray-400">
        尚未建立多物品組合樹，請回到主視窗建立。
      </div>
    );
  }

  return (
    <MultiItemCombinedTree
      standalone
      itemList={builtTree}
      selectedServerOption={selectedServerOption}
      selectedWorld={selectedWorld}
      worlds={worlds}
      onItemSelect={handleItemSelect}
      excludeCrystals={excludeCrystals}
    />
  );
}
