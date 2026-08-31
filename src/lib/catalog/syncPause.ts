/** Pause background catalog pulls while admin forms are open (avoids stale overwrites). */
let pauseCount = 0;

export function pauseCatalogSync(): () => void {
  pauseCount += 1;
  return () => {
    pauseCount = Math.max(0, pauseCount - 1);
  };
}

export function isCatalogSyncPaused(): boolean {
  return pauseCount > 0;
}
