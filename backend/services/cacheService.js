/**
 * Generic Cache Service using PostgreSQL (CacheEntry table)
 * Caches FPL API responses with smart TTLs per endpoint type
 */
const prisma = require('./db');

/**
 * Get cached data by key
 * @param {string} key - Cache key
 * @returns {object|null} Cached data or null if miss/expired
 */
async function getCached(key) {
  try {
    const entry = await prisma.cacheEntry.findUnique({ where: { key } });
    if (!entry) return null;

    // Check expiry (null expiresAt = never expires)
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      // Expired - delete async, return null
      prisma.cacheEntry.delete({ where: { key } }).catch(() => {});
      return null;
    }

    return entry.data;
  } catch (error) {
    console.error(`[Cache] Error reading key "${key}":`, error.message);
    return null;
  }
}

/**
 * Store data in cache
 * @param {string} key - Cache key
 * @param {object} data - Data to cache (JSON-serializable)
 * @param {number|null} ttlMs - Time to live in ms (null = never expires)
 */
async function setCache(key, data, ttlMs = null) {
  try {
    const expiresAt = ttlMs ? new Date(Date.now() + ttlMs) : null;

    await prisma.cacheEntry.upsert({
      where: { key },
      update: { data, expiresAt, lastUpdated: new Date() },
      create: { key, data, expiresAt },
    });
  } catch (error) {
    console.error(`[Cache] Error writing key "${key}":`, error.message);
  }
}

/**
 * Invalidate (delete) a cache entry
 * @param {string} key - Cache key to remove
 */
async function invalidateCache(key) {
  try {
    await prisma.cacheEntry.delete({ where: { key } }).catch(() => {});
  } catch (error) {
    // Ignore - might not exist
  }
}

/**
 * Invalidate all cache entries matching a prefix
 * @param {string} prefix - Key prefix to match
 */
async function invalidateByPrefix(prefix) {
  try {
    await prisma.cacheEntry.deleteMany({
      where: { key: { startsWith: prefix } },
    });
  } catch (error) {
    console.error(`[Cache] Error invalidating prefix "${prefix}":`, error.message);
  }
}

/**
 * Get smart TTL based on FPL API path
 * @param {string} path - FPL API path (e.g. '/bootstrap-static/')
 * @param {boolean} isLive - Whether a gameweek is currently in progress
 * @returns {number|null} TTL in ms (null = cache forever)
 */
function getTTLForPath(path, isLive = false) {
  // Picks are immutable after GW deadline
  if (path.match(/\/entry\/\d+\/event\/\d+\/picks\//)) {
    return null; // Forever
  }

  // Bootstrap - core data, changes infrequently
  if (path.includes('/bootstrap-static/')) {
    return 10 * 60 * 1000; // 10 min
  }

  // Fixtures
  if (path.includes('/fixtures/')) {
    return isLive ? 5 * 60 * 1000 : 60 * 60 * 1000; // 5 min live, 1 hour otherwise
  }

  // Manager history - changes during live GW
  if (path.match(/\/entry\/\d+\/history\//)) {
    return 5 * 60 * 1000; // 5 min
  }

  // Manager transfers
  if (path.match(/\/entry\/\d+\/transfers\//)) {
    return 5 * 60 * 1000; // 5 min
  }

  // Live data - very short TTL
  if (path.match(/\/event\/\d+\/live\//)) {
    return 30 * 1000; // 30 sec
  }

  // Element summary (player history)
  if (path.match(/\/element-summary\/\d+\//)) {
    return 10 * 60 * 1000; // 10 min
  }

  // League standings
  if (path.match(/\/leagues-classic\/\d+\/standings/)) {
    return 5 * 60 * 1000; // 5 min
  }

  // Default: 5 minutes
  return 5 * 60 * 1000;
}

/**
 * Clean up expired cache entries (run periodically)
 */
async function cleanExpiredCache() {
  try {
    const result = await prisma.cacheEntry.deleteMany({
      where: {
        expiresAt: { not: null, lt: new Date() },
      },
    });
    if (result.count > 0) {
      console.log(`[Cache] Cleaned ${result.count} expired entries`);
    }
  } catch (error) {
    console.error('[Cache] Error cleaning expired entries:', error.message);
  }
}

module.exports = {
  getCached,
  setCache,
  invalidateCache,
  invalidateByPrefix,
  getTTLForPath,
  cleanExpiredCache,
};
