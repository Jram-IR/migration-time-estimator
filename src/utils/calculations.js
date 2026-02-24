/**
 * Migration time calculation logic
 */

const DEBUG = true;

function log(...args) {
  if (DEBUG && typeof console !== 'undefined') {
    console.log(...args);
  }
}

/**
 * Calculate upper limit (entities per minute) from TPM and MaxWrites
 * TPS = TPM/60, entities/sec = floor(TPS/MaxWrites), entities/min = entities/sec * 60
 */
export function calculateUpperLimit(tpm, maxWrites) {
  const tps = tpm / 60;
  const entitiesPerSec = Math.floor(tps / maxWrites);
  const upperLimit = entitiesPerSec * 60;
  if (DEBUG) {
    log(`  [calculateUpperLimit] TPM=${tpm}, MaxWrites=${maxWrites} => TPS=${tps.toFixed(2)}, entities/sec=${entitiesPerSec}, upperLimit=${upperLimit}/min`);
  }
  return upperLimit;
}

/**
 * Calculate effective concurrency (average entities per wave)
 */
export function calculateEffectiveConcurrency(batchSize, concurrency) {
  const numWaves = Math.ceil(batchSize / concurrency);
  let totalEntities = 0;
  let remaining = batchSize;
  const waveSizes = [];
  for (let i = 0; i < numWaves; i++) {
    const waveSize = Math.min(concurrency, remaining);
    waveSizes.push(waveSize);
    totalEntities += waveSize;
    remaining -= waveSize;
  }
  const effectiveConcurrency = Math.floor(totalEntities / numWaves);
  if (DEBUG) {
    log(`  [calculateEffectiveConcurrency] batchSize=${batchSize}, concurrency=${concurrency} => numWaves=${numWaves}, waveSizes=[${waveSizes.join(',')}], effective=${effectiveConcurrency}`);
  }
  return effectiveConcurrency;
}

/**
 * Calculate gross duration for a batch (in seconds)
 * grossDuration = (durationPerEntity * numWaves) + delay
 */
export function calculateGrossDuration(batchSize, concurrency, durationPerEntity, delayInSeconds) {
  const numWaves = Math.ceil(batchSize / concurrency);
  const durationFromWaves = durationPerEntity * numWaves;
  const grossDuration = durationFromWaves + delayInSeconds;
  if (DEBUG) {
    log(`  [calculateGrossDuration] batchSize=${batchSize}, concurrency=${concurrency}, durationPerEntity=${durationPerEntity}s, delay=${delayInSeconds}s => numWaves=${numWaves}, grossDuration=${grossDuration}s`);
  }
  return grossDuration;
}

/**
 * Calculate effective rate (entities per minute)
 * effective_rate = (batchSize / grossDuration) * 60
 */
export function calculateEffectiveRate(batchSize, grossDuration) {
  if (grossDuration <= 0) return 0;
  const rate = (batchSize / grossDuration) * 60;
  if (DEBUG) {
    log(`  [calculateEffectiveRate] batchSize=${batchSize}, grossDuration=${grossDuration}s => rate=${rate.toFixed(2)}/min`);
  }
  return rate;
}

/**
 * Check if effective rate has less than 20% leeway (warning threshold)
 * Safe if effective_rate <= 80% of upper limit
 */
export function needsWarning(effectiveRate, upperLimit) {
  if (upperLimit <= 0) return false;
  const safeThreshold = upperLimit * 0.8; // 80% = 20% leeway
  const warn = effectiveRate > safeThreshold;
  if (DEBUG && warn) {
    log(`  [needsWarning] effectiveRate=${effectiveRate.toFixed(2)}, upperLimit=${upperLimit}, safeThreshold=${safeThreshold} => WARNING`);
  }
  return warn;
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

/**
 * Full migration time estimation with comprehensive debug logging
 */
export function estimateMigrationTime(params) {
  const {
    batchSize,
    concurrency,
    delayInSeconds,
    cesLimits,
    durations,
    totals,
    maxWritesByEntity,
    bufferTime,
  } = params;

  log('\n' + '='.repeat(80));
  log('MIGRATION TIME ESTIMATION - FULL COMPUTATION');
  log('='.repeat(80));
  log('\n--- INPUTS ---');
  log('batchSize:', batchSize);
  log('concurrency:', concurrency);
  log('delayInSeconds:', delayInSeconds);
  log('cesLimits (TPM):', JSON.stringify(cesLimits));
  log('durations (sec):', JSON.stringify(durations));
  log('totals (counts):', JSON.stringify(totals));
  log('maxWritesByEntity:', JSON.stringify(maxWritesByEntity));
  log('bufferTime (%):', bufferTime);

  const entityTypes = ['Company', 'Site', 'Contact'];
  const upperLimits = {};
  const effectiveRates = {};
  const grossDurations = {};
  const hasWarnings = {};

  log('\n--- STEP 1: UPPER LIMITS (CES) ---');
  entityTypes.forEach((entity) => {
    const tpm = cesLimits[entity] || 0;
    const maxWrites = maxWritesByEntity[entity] || 1;
    upperLimits[entity] = calculateUpperLimit(tpm, maxWrites);
    log(`${entity}: TPM=${tpm}, MaxWrites=${maxWrites} => Upper limit = ${upperLimits[entity]} entities/min`);
  });

  log('\n--- STEP 2: GROSS DURATION & EFFECTIVE RATE ---');
  entityTypes.forEach((entity) => {
    const duration = durations[entity] || 0;
    grossDurations[entity] = calculateGrossDuration(
      batchSize,
      concurrency,
      duration,
      delayInSeconds
    );
    effectiveRates[entity] = calculateEffectiveRate(batchSize, grossDurations[entity]);
    hasWarnings[entity] = needsWarning(effectiveRates[entity], upperLimits[entity]);
    log(`${entity}: Gross duration = ${grossDurations[entity]}s, Effective rate = ${effectiveRates[entity].toFixed(2)}/min, Warning = ${hasWarnings[entity]}`);
  });

  log('\n--- STEP 3: TOTAL MIGRATION TIME ---');
  let totalMinutes = 0;
  const timeByEntity = {};
  entityTypes.forEach((entity) => {
    const count = totals[entity] || 0;
    const rate = effectiveRates[entity] || 1;
    if (count > 0 && rate > 0) {
      const entityMinutes = count / rate;
      timeByEntity[entity] = entityMinutes;
      totalMinutes += entityMinutes;
      log(`${entity}: ${count} / ${rate.toFixed(2)} = ${entityMinutes.toFixed(2)} min`);
    } else {
      timeByEntity[entity] = 0;
      log(`${entity}: ${count} entities, rate ${rate.toFixed(2)} => skipped (0 min)`);
    }
  });

  log('\n--- STEP 4: BUFFER ---');
  const bufferMultiplier = 1 + bufferTime / 100;
  const totalMinutesBeforeBuffer = totalMinutes;
  totalMinutes *= bufferMultiplier;
  log(`Total before buffer: ${totalMinutesBeforeBuffer.toFixed(2)} min`);
  log(`Buffer: ${bufferTime}% => multiplier = ${bufferMultiplier}`);
  log(`Total after buffer: ${totalMinutes.toFixed(2)} min`);

  const formattedTime = formatMigrationTime(totalMinutes);
  log('\n--- RESULT ---');
  log('Estimated Migration Time:', formattedTime, `(${totalMinutes.toFixed(2)} minutes)`);
  log('='.repeat(80) + '\n');

  return {
    migrationTime: formattedTime,
    totalMinutes,
    effectiveRates,
    upperLimits,
    grossDurations,
    timeByEntity,
    hasWarnings,
  };
}
