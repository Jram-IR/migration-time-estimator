/**
 * Migration time calculation logic
 */

/**
 * Calculate upper limit (entities per minute) from TPM and MaxWrites
 * TPS = TPM/60, entities/sec = floor(TPS/MaxWrites), entities/min = entities/sec * 60
 */
export function calculateUpperLimit(tpm, maxWrites) {
  const safeMaxWrites = Math.max(1, Number(maxWrites) || 1);
  const tps = (Number(tpm) || 0) / 60;
  const entitiesPerSec = Math.floor(tps / safeMaxWrites);
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
 */
export function calculateGrossDuration(batchSize, concurrency, durationPerEntity, delayInSeconds) {
  const numWaves = Math.ceil(batchSize / concurrency);
  return (durationPerEntity * numWaves) + delayInSeconds;
}

/**
 * Calculate effective rate (entities per minute)
 */
export function calculateEffectiveRate(batchSize, grossDuration) {
  if (grossDuration <= 0) return 0;
  return (batchSize / grossDuration) * 60;
}

/**
 * Check if effective rate has less than 20% leeway (warning threshold)
 */
export function needsWarning(effectiveRate, upperLimit) {
  if (upperLimit <= 0) return false;
  const safeThreshold = upperLimit * 0.8;
  return effectiveRate > safeThreshold;
}

/**
 * Format minutes to dd:hh:mm:ss with unit indicators (D, H, M, S)
 */
export function formatMigrationTime(totalMinutes) {
  if (totalMinutes <= 0 || !isFinite(totalMinutes)) return '00D:00H:00M:00S';
  const totalSeconds = Math.round(totalMinutes * 60);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => n.toString().padStart(2, '0');
  return `${pad(days)}D:${pad(hours)}H:${pad(minutes)}M:${pad(seconds)}S`;
}

/**
 * Full migration time estimation - returns result and report data for CSV export
 */
export function estimateMigrationTime(params = {}) {
  const {
    batchSize = 100,
    concurrency = 50,
    delayInSeconds = 30,
    cesLimits = {},
    durations = {},
    totals = {},
    maxWritesByEntity = {},
    bufferTime = 0,
  } = params;

  const entityTypes = ['Company', 'Site', 'Contact'];
  const upperLimits = {};
  const effectiveRates = {};
  const grossDurations = {};
  const hasWarnings = {};
  const timeByEntity = {};

  entityTypes.forEach((entity) => {
    const tpm = cesLimits[entity] || 0;
    const maxWrites = maxWritesByEntity[entity] || 1;
    upperLimits[entity] = calculateUpperLimit(tpm, maxWrites);
  });

  entityTypes.forEach((entity) => {
    const duration = durations[entity] || 0;
    grossDurations[entity] = calculateGrossDuration(batchSize, concurrency, duration, delayInSeconds);
    effectiveRates[entity] = calculateEffectiveRate(batchSize, grossDurations[entity]);
    hasWarnings[entity] = needsWarning(effectiveRates[entity], upperLimits[entity]);
  });

  let totalMinutes = 0;
  entityTypes.forEach((entity) => {
    const count = totals[entity] || 0;
    const rate = effectiveRates[entity] || 1;
    if (count > 0 && rate > 0) {
      timeByEntity[entity] = count / rate;
      totalMinutes += timeByEntity[entity];
    } else {
      timeByEntity[entity] = 0;
    }
  });

  const bufferMultiplier = 1 + bufferTime / 100;
  const totalMinutesBeforeBuffer = totalMinutes;
  totalMinutes *= bufferMultiplier;
  const formattedTime = formatMigrationTime(totalMinutes);

  return {
    migrationTime: formattedTime,
    totalMinutes,
    effectiveRates,
    upperLimits,
    grossDurations,
    timeByEntity,
    hasWarnings,
    report: {
      batchSize,
      concurrency,
      delayInSeconds,
      cesLimits,
      durations,
      totals,
      maxWritesByEntity,
      bufferTime,
      upperLimits,
      grossDurations,
      effectiveRates,
      timeByEntity,
      totalMinutesBeforeBuffer,
      bufferMultiplier,
      totalMinutesAfterBuffer: totalMinutes,
      formattedTime,
    },
  };
}

/**
 * Generate CSV content from migration estimation report
 */
export function generateReportCSV(report) {
  if (!report) return '';

  const r = report;
  const rows = [
    ['Migration Time Estimator - Calculation Summary', ''],
    ['Generated', new Date().toISOString()],
    [''],
    ['--- INPUTS ---', ''],
    ['Batch Size', r.batchSize],
    ['Concurrency', r.concurrency],
    ['Delay (seconds)', r.delayInSeconds],
    ['Buffer Time (%)', r.bufferTime],
    [''],
    ['CES Limits (TPM)', 'Company', 'Site', 'Contact'],
    ['', r.cesLimits?.Company ?? '', r.cesLimits?.Site ?? '', r.cesLimits?.Contact ?? ''],
    [''],
    ['Durations (sec)', 'Company', 'Site', 'Contact'],
    ['', r.durations?.Company ?? '', r.durations?.Site ?? '', r.durations?.Contact ?? ''],
    [''],
    ['Total Counts', 'Company', 'Site', 'Contact'],
    ['', r.totals?.Company ?? '', r.totals?.Site ?? '', r.totals?.Contact ?? ''],
    [''],
    ['Max Writes', 'Company', 'Site', 'Contact'],
    ['', r.maxWritesByEntity?.Company ?? '', r.maxWritesByEntity?.Site ?? '', r.maxWritesByEntity?.Contact ?? ''],
    [''],
    ['--- STEP 1: UPPER LIMITS (entities/min) ---', ''],
    ['Entity', 'Upper Limit'],
    ['Company', r.upperLimits?.Company ?? ''],
    ['Site', r.upperLimits?.Site ?? ''],
    ['Contact', r.upperLimits?.Contact ?? ''],
    [''],
    ['--- STEP 2: GROSS DURATION & EFFECTIVE RATE ---', ''],
    ['Entity', 'Gross Duration (sec)', 'Effective Rate (/min)'],
    ['Company', r.grossDurations?.Company ?? '', r.effectiveRates?.Company?.toFixed(2) ?? ''],
    ['Site', r.grossDurations?.Site ?? '', r.effectiveRates?.Site?.toFixed(2) ?? ''],
    ['Contact', r.grossDurations?.Contact ?? '', r.effectiveRates?.Contact?.toFixed(2) ?? ''],
    [''],
    ['--- STEP 3: TIME BY ENTITY ---', ''],
    ['Entity', 'Time (minutes)'],
    ['Company', r.timeByEntity?.Company?.toFixed(2) ?? '0'],
    ['Site', r.timeByEntity?.Site?.toFixed(2) ?? '0'],
    ['Contact', r.timeByEntity?.Contact?.toFixed(2) ?? '0'],
    ['Total (before buffer)', r.totalMinutesBeforeBuffer?.toFixed(2) ?? '0'],
    [''],
    ['--- STEP 4: BUFFER ---', ''],
    ['Buffer multiplier', r.bufferMultiplier?.toFixed(2) ?? '1'],
    ['Total after buffer (min)', r.totalMinutesAfterBuffer?.toFixed(2) ?? '0'],
    [''],
    ['--- RESULT ---', ''],
    ['Estimated Migration Time', r.formattedTime ?? '00D:00H:00M:00S'],
  ];

  return rows.map(row => (Array.isArray(row) ? row : [row]).map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}
