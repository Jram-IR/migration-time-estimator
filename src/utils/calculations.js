/**
 * Migration time calculation logic
 */

/**
 * Calculate upper limit (entities per minute) from TPM and MaxWrites
 * TPS = TPM/60, entities/sec = floor(TPS/MaxWrites), entities/min = entities/sec * 60
 */
export function calculateUpperLimit(tpm, maxWrites) {
  const tps = tpm / 60;
  const entitiesPerSec = Math.floor(tps / maxWrites);
  return entitiesPerSec * 60;
}

/**
 * Calculate effective concurrency (average entities per wave)
 */
export function calculateEffectiveConcurrency(batchSize, concurrency) {
  const numWaves = Math.ceil(batchSize / concurrency);
  let totalEntities = 0;
  let remaining = batchSize;
  for (let i = 0; i < numWaves; i++) {
    const waveSize = Math.min(concurrency, remaining);
    totalEntities += waveSize;
    remaining -= waveSize;
  }
  return Math.floor(totalEntities / numWaves);
}

/**
 * Calculate gross duration for a batch (in seconds)
 * grossDuration = (durationPerEntity * numWaves) + delay
 */
export function calculateGrossDuration(batchSize, concurrency, durationPerEntity, delayInSeconds) {
  const numWaves = Math.ceil(batchSize / concurrency);
  return (durationPerEntity * numWaves) + delayInSeconds;
}

/**
 * Calculate effective rate (entities per minute)
 * effective_rate = (batchSize / grossDuration) * 60
 */
export function calculateEffectiveRate(batchSize, grossDuration) {
  if (grossDuration <= 0) return 0;
  return (batchSize / grossDuration) * 60;
}

/**
 * Check if effective rate has less than 20% leeway (warning threshold)
 * Safe if effective_rate <= 80% of upper limit
 */
export function needsWarning(effectiveRate, upperLimit) {
  if (upperLimit <= 0) return false;
  const safeThreshold = upperLimit * 0.8; // 80% = 20% leeway
  return effectiveRate > safeThreshold;
}

/**
 * Format minutes to hh:mm:ss
 */
export function formatMigrationTime(totalMinutes) {
  if (totalMinutes <= 0 || !isFinite(totalMinutes)) {
    return '00:00:00';
  }
  const totalSeconds = Math.round(totalMinutes * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
