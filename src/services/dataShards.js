/**
 * Sharded data reader: loads only the shards that hold the requested ids (see src/constants/dataShards.js).
 * Falls back to the full <domain>.msgpack when shards are unavailable (e.g. dev without build-data-shards).
 */

import { decode } from '@msgpack/msgpack';
import { SHARDED_DOMAINS, shardOf } from '../constants/dataShards.js';

const BASE = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '') + '/data';

const shardPromises = new Map(); // `${domain}/${shard}` -> Promise<object>
const fullPromises = new Map(); // domain -> Promise<object>
const shardsUnavailable = new Set(); // domains whose shards 404'd; use the full file instead

async function fetchMsgpack(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const err = new Error(`Failed to fetch ${url}: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return decode(new Uint8Array(await res.arrayBuffer()));
}

// Loads are shared between callers, so an AbortSignal only stops the caller waiting, not the fetch
// (another caller may still need the same shard).
function withSignal(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException('Request aborted', 'AbortError'));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Request aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

function loadFull(domain) {
  if (!fullPromises.has(domain)) {
    const p = fetchMsgpack(`${BASE}/${domain}.msgpack`).catch(err => {
      fullPromises.delete(domain);
      throw err;
    });
    fullPromises.set(domain, p);
  }
  return fullPromises.get(domain);
}

function loadShard(domain, shard) {
  const key = `${domain}/${shard}`;
  if (!shardPromises.has(key)) {
    const p = fetchMsgpack(`${BASE}/shards/${domain}/${shard}.msgpack`).catch(err => {
      shardPromises.delete(key);
      throw err;
    });
    shardPromises.set(key, p);
  }
  return shardPromises.get(key);
}

function mergeInto(target, part, flat) {
  if (!part) return target;
  if (flat) return Object.assign(target, part);
  for (const [table, rows] of Object.entries(part)) {
    target[table] = Object.assign(target[table] || {}, rows);
  }
  return target;
}

/**
 * Load the records for `ids` from a sharded domain.
 * Returns the same shape as the full domain file, containing (at least) the requested ids.
 */
export async function loadDomainRecords(domain, ids, signal = null) {
  const config = SHARDED_DOMAINS[domain];
  if (!config) throw new Error(`Unknown sharded domain: ${domain}`);
  const uniqueShards = [...new Set((ids || []).map(id => shardOf(id, config.shards)))];
  if (uniqueShards.length === 0) return {};

  if (!shardsUnavailable.has(domain)) {
    try {
      const parts = await withSignal(Promise.all(uniqueShards.map(s => loadShard(domain, s))), signal);
      return parts.reduce((acc, part) => mergeInto(acc, part, config.flat), {});
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      if (err?.status !== 404) throw err;
      shardsUnavailable.add(domain);
      console.warn(`[dataShards] shards for ${domain} not found, falling back to ${domain}.msgpack`);
    }
  }
  return withSignal(loadFull(domain), signal);
}

/**
 * Warm the shards for `ids` without waiting on them (e.g. on hover or idle).
 */
export function prefetchDomainRecords(domain, ids) {
  loadDomainRecords(domain, ids).catch(() => {});
}
