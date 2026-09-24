// Lets the page pause background prefetching while the user is waiting on something specific
// (e.g. an item page's 取得方式 data), so bulk downloads don't compete with it.

let holds = 0;
let waiters = [];

function releaseAll() {
  if (holds > 0) return;
  const pending = waiters;
  waiters = [];
  pending.forEach(resolve => resolve());
}

/**
 * Pause prefetching until the returned release() is called or `maxMs` passes, whichever is first.
 */
export function holdPrefetch(maxMs = 2000) {
  holds++;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    clearTimeout(timer);
    holds--;
    releaseAll();
  };
  const timer = setTimeout(release, maxMs);
  return release;
}

/** Resolves when no hold is active. */
export function waitForPrefetchGate() {
  if (holds === 0) return Promise.resolve();
  return new Promise(resolve => waiters.push(resolve));
}
