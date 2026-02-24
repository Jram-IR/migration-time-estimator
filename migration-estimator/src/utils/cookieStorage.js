/**
 * Cookie utilities for storing CES limit configurations
 */

const COOKIE_NAME = 'migration_estimator_ces_limits';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

export function getCESLimitsFromCookie() {
  try {
    const cookies = document.cookie.split(';');
    const cesCookie = cookies.find(c => c.trim().startsWith(`${COOKIE_NAME}=`));
    if (cesCookie) {
      const value = decodeURIComponent(cesCookie.split('=')[1].trim());
      return JSON.parse(value);
    }
  } catch (e) {
    console.error('Error reading CES limits from cookie:', e);
  }
  return [];
}

export function saveCESLimitsToCookie(limits) {
  try {
    const value = encodeURIComponent(JSON.stringify(limits));
    document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch (e) {
    console.error('Error saving CES limits to cookie:', e);
  }
}

export function addCESLimitToCookie(limitConfig) {
  const limits = getCESLimitsFromCookie();
  const exists = limits.some(l => l.name === limitConfig.name);
  let updated;
  if (exists) {
    updated = limits.map(l => l.name === limitConfig.name ? limitConfig : l);
  } else {
    updated = [...limits, limitConfig];
  }
  saveCESLimitsToCookie(updated);
  return updated;
}
