import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Slider,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  IconButton,
  Alert,
  Snackbar,
  FormControlLabel,
  RadioGroup,
  Radio,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  needsWarning,
  estimateMigrationTime,
  generateReportCSV,
} from './utils/calculations';
import { getCESLimitsFromCookie, addCESLimitToCookie, deleteCESLimitFromCookie } from './utils/cookieStorage';
import './App.css';

const ENTITY_TYPES = ['Company', 'Site', 'Contact'];
const DEFAULT_TPM = { Company: 5600, Site: 7300, Contact: 10000 };
const DEFAULT_DURATIONS = { Company: 20, Site: 5, Contact: 5 };
const DEFAULT_TOTALS = { Company: 0, Site: 0, Contact: 0 };
const DEFAULT_MAX_WRITES = { Company: 16, Site: 16, Contact: 16 };

function formatWithCommas(num) {
  const n = Number(num);
  if (n === 0 || isNaN(n)) return '0';
  return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function parseInteger(str) {
  const digits = (str || '').replace(/\D/g, '');
  return digits === '' ? 0 : parseInt(digits, 10);
}

function downloadCSV(content, filename = 'migration-estimation-report.csv') {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function App() {
  const [batchSize, setBatchSize] = useState(100);
  const [concurrency, setConcurrency] = useState(50);
  const [delay, setDelay] = useState(30);
  const [delayUnit, setDelayUnit] = useState('sec');
  const [cesLimits, setCesLimits] = useState({ Company: 5600, Site: 7300, Contact: 10000 });
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState('Default');
  const [newConfigName, setNewConfigName] = useState('');
  const [durations, setDurations] = useState(DEFAULT_DURATIONS);
  const [totals, setTotals] = useState(DEFAULT_TOTALS);
  const [maxWrites, setMaxWrites] = useState(DEFAULT_MAX_WRITES);
  const [bufferTime, setBufferTime] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const resultRef = useRef(null);

  useEffect(() => {
    try {
      const saved = getCESLimitsFromCookie();
      if (Array.isArray(saved) && saved.length > 0 && saved[0]?.name && saved[0]?.limits) {
        setSavedConfigs(saved);
        setSelectedConfig(saved[0].name);
        setCesLimits(saved[0].limits);
      } else {
        setSelectedConfig('Default');
      }
    } catch (e) {
      setSelectedConfig('Default');
    }
  }, []);

  useEffect(() => {
    if (selectedConfig === 'Default') {
      setCesLimits(DEFAULT_TPM);
    } else if (selectedConfig && savedConfigs.length > 0) {
      const config = savedConfigs.find(c => c.name === selectedConfig);
      if (config) setCesLimits(config.limits);
    }
  }, [selectedConfig, savedConfigs]);

  const delayInSeconds = delayUnit === 'min' ? delay * 60 : delay;

  const validPresetNames = ['Default', ...savedConfigs.map(c => c.name)];
  const safeSelectedConfig = validPresetNames.includes(selectedConfig) ? selectedConfig : 'Default';

  const estimationResult = useMemo(() => {
    try {
      return estimateMigrationTime({
        batchSize: Math.max(1, batchSize),
        concurrency: Math.max(1, concurrency),
        delayInSeconds,
        cesLimits,
        durations,
        totals,
        maxWritesByEntity: maxWrites,
        bufferTime,
      });
    } catch (err) {
      return {
        migrationTime: '00:00:00',
        effectiveRates: {},
        upperLimits: {},
        hasWarnings: {},
        report: null,
      };
    }
  }, [batchSize, concurrency, delayInSeconds, cesLimits, durations, totals, maxWrites, bufferTime]);

  resultRef.current = estimationResult;

  const hasWarningsObj = estimationResult.hasWarnings || {};
  const hasWarnings = Object.values(hasWarningsObj).some(Boolean);

  const { migrationTime, effectiveRates, upperLimits } = {
    migrationTime: estimationResult.migrationTime,
    effectiveRates: estimationResult.effectiveRates || {},
    upperLimits: estimationResult.upperLimits || {},
  };

  const handleCreateConfig = () => {
    if (!newConfigName.trim()) return;
    const config = { name: newConfigName.trim(), limits: { ...cesLimits } };
    const updated = addCESLimitToCookie(config);
    setSavedConfigs(updated);
    setSelectedConfig(config.name);
    setNewConfigName('');
    setSnackbar({ open: true, message: `Created "${config.name}"` });
  };

  const handleUpdateConfig = () => {
    if (selectedConfig === 'Default') return;
    const config = { name: selectedConfig, limits: { ...cesLimits } };
    const updated = addCESLimitToCookie(config);
    setSavedConfigs(updated);
    setSnackbar({ open: true, message: `Saved "${selectedConfig}"` });
  };

  const handleDeleteConfig = () => {
    if (selectedConfig === 'Default') return;
    const updated = deleteCESLimitFromCookie(selectedConfig);
    setSavedConfigs(updated);
    setSelectedConfig(updated.length > 0 ? updated[0].name : 'Default');
    if (updated.length > 0) setCesLimits(updated[0].limits);
    else setCesLimits(DEFAULT_TPM);
    setSnackbar({ open: true, message: `Deleted "${selectedConfig}"` });
  };

  const handleDownloadReport = () => {
    const report = resultRef.current?.report;
    if (report) {
      const csv = generateReportCSV(report);
      downloadCSV(csv);
      setSnackbar({ open: true, message: 'Report downloaded' });
    }
  };

  const handleTPMChange = (entity, value) => {
    const num = parseInteger(value);
    setCesLimits(prev => ({ ...prev, [entity]: num >= 0 ? num : 0 }));
  };

  const handleDurationChange = (entity, value) => {
    const num = parseInteger(value);
    setDurations(prev => ({ ...prev, [entity]: num >= 0 ? num : 0 }));
  };

  const handleTotalChange = (entity, value) => {
    setTotals(prev => ({ ...prev, [entity]: parseInteger(value) }));
  };

  const handleMaxWritesChange = (entity, value) => {
    const num = parseInteger(value);
    setMaxWrites(prev => ({ ...prev, [entity]: num >= 1 ? num : 1 }));
  };

  const handleBufferChange = (value) => {
    const num = parseInteger(value);
    setBufferTime(num >= 0 ? num : 0);
  };

  const isCustomPreset = selectedConfig !== 'Default' && savedConfigs.some(c => c.name === selectedConfig);

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', py: { xs: 2, sm: 4 }, px: { xs: 1.5, sm: 2 } }}>
      <Typography variant="h4" component="h1" sx={{ color: 'white', textAlign: 'center', mb: { xs: 3, sm: 4 }, fontWeight: 700, letterSpacing: 1, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
        Migration Estimator
      </Typography>

      <Box sx={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        {/* Small screen: stacked. Large screen: 3 columns (Col1: Migration+Entity | Col2: Config | Col3: CES) */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            '@media (min-width: 960px)': {
              flexDirection: 'row',
              alignItems: 'flex-start',
            },
          }}
        >
          {/* Column 1 (large screen) or Rows 1+3 (small screen): Migration Time + Entity Config */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              flex: 1,
              minWidth: 0,
              '@media (min-width: 960px)': {
                flex: '0 0 400px',
                minWidth: 400,
                maxWidth: 400,
              },
            }}
          >
            {/* Warnings + Migration Time */}
            <Box sx={{ width: '100%', position: 'relative' }}>
              {hasWarnings && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1px', mb: '1px' }}>
                  {ENTITY_TYPES.filter(entity => needsWarning(effectiveRates[entity] || 0, upperLimits[entity] || 0)).map(entity => (
                    <Alert key={entity} severity="warning" sx={{ py: 0.5 }}>
                      {entity}: Effective rate ({Math.round(effectiveRates[entity])}/min) exceeds 80% of limit ({upperLimits[entity]}/min)
                    </Alert>
                  ))}
                </Box>
              )}
              <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5, position: 'relative' }}>Estimated Migration Time</Typography>
              <Paper sx={{ width: '100%', p: { xs: 2, sm: 4 }, pt: { xs: 4, sm: 5 }, textAlign: 'center', backgroundColor: hasWarnings ? 'rgba(255, 193, 7, 0.2)' : 'rgba(76, 175, 80, 0.2)', border: 2, borderColor: hasWarnings ? 'warning.main' : 'primary.main', boxSizing: 'border-box', position: 'relative' }}>
                <Button
                  variant="contained"
                  onClick={handleDownloadReport}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    backgroundColor: '#2e7d32',
                    color: 'white',
                    '&:hover': { backgroundColor: '#1b5e20' },
                  }}
                >
                  ⬇ Download Report
                </Button>
                <Typography variant="h2" component="div" sx={{ fontWeight: 700, color: 'primary.main', fontFamily: 'monospace', letterSpacing: { xs: 1, sm: 4 }, fontSize: { xs: '2rem', sm: '3rem' } }}>
                  {migrationTime}
                </Typography>
              </Paper>
            </Box>

            {/* Entity Configuration - on small screen same width as Config+CES via flex */}
            <Paper sx={{ width: '100%', p: '15px', backgroundColor: 'rgba(255,255,255,0.95)', boxSizing: 'border-box', '@media (min-width: 960px)': { minWidth: 400, maxWidth: 400 } }}>
              <Typography variant="h6" gutterBottom>Entity Configuration</Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', width: '100%' }}>
                {ENTITY_TYPES.map(entity => (
                  <Card key={entity} variant="outlined" sx={{ flex: '1 1 0', minWidth: 0 }}>
                    <CardContent>
                      <Typography variant="subtitle2" color="primary">{entity}</Typography>
                      <TextField fullWidth size="small" label="Duration (sec)" type="text" inputMode="numeric" value={durations[entity] ?? ''} onChange={(e) => handleDurationChange(entity, e.target.value)} sx={{ mt: 1 }} />
                      <TextField fullWidth size="small" label="Total count" value={formatWithCommas(totals[entity] ?? 0)} onChange={(e) => handleTotalChange(entity, e.target.value)} placeholder="0" inputProps={{ inputMode: 'numeric' }} sx={{ mt: 1 }} />
                      <TextField fullWidth size="small" label="Max writes" type="text" inputMode="numeric" value={maxWrites[entity] ?? ''} onChange={(e) => handleMaxWritesChange(entity, e.target.value)} sx={{ mt: 1 }} />
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Paper>
          </Box>

          {/* Column 2 & 3 (large screen) or Row 2 (small screen): Configuration | CES Write Limits */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, '@media (min-width: 500px)': { flexDirection: 'row' }, '@media (min-width: 960px)': { flex: 1, minWidth: 0 } }}>
            <Paper sx={{ flex: 1, minWidth: 280, p: { xs: 2, sm: 3 }, backgroundColor: 'rgba(255,255,255,0.95)', minHeight: 320 }}>
              <Typography variant="h6" gutterBottom>Configuration</Typography>
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
                <Typography flex={1}>Batch Size</Typography>
                <TextField size="small" type="text" inputMode="numeric" value={batchSize === 0 ? '' : batchSize} onChange={(e) => { const v = parseInteger(e.target.value); setBatchSize(v <= 1000 ? v : 1000); }} sx={{ width: 80 }} />
              </Box>
              <Slider value={batchSize} onChange={(_, v) => setBatchSize(v)} min={1} max={1000} valueLabelDisplay="auto" />
            </Box>
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
                <Typography flex={1}>Concurrency</Typography>
                <TextField size="small" type="text" inputMode="numeric" value={concurrency === 0 ? '' : concurrency} onChange={(e) => { const v = parseInteger(e.target.value); setConcurrency(v <= 500 ? v : 500); }} sx={{ width: 80 }} />
              </Box>
              <Slider value={concurrency} onChange={(_, v) => setConcurrency(v)} min={1} max={500} valueLabelDisplay="auto" />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
                <Typography flex={1}>Delay</Typography>
                <TextField size="small" type="text" inputMode="numeric" value={delay} onChange={(e) => { const v = parseInteger(e.target.value); const max = delayUnit === 'sec' ? 600 : 30; setDelay(v >= 0 && v <= max ? v : delay); }} sx={{ width: 80 }} />
                <Typography variant="body2">{delayUnit}</Typography>
              </Box>
              <Slider value={delay} onChange={(_, v) => setDelay(v)} min={0} max={delayUnit === 'sec' ? 600 : 30} valueLabelDisplay="auto" />
              <RadioGroup row value={delayUnit} onChange={(e) => setDelayUnit(e.target.value)} sx={{ mt: 1 }}>
                <FormControlLabel value="sec" control={<Radio size="small" />} label="Seconds" />
                <FormControlLabel value="min" control={<Radio size="small" />} label="Minutes" />
              </RadioGroup>
            </Box>
            <Box sx={{ mt: 2 }}>
              <TextField
                size="small"
                label="Buffer time (%)"
                type="text"
                inputMode="numeric"
                value={bufferTime === 0 ? '' : String(bufferTime)}
                onChange={(e) => handleBufferChange(e.target.value)}
                sx={{ width: 200 }}
              />
            </Box>
            </Paper>
            <Paper sx={{ flex: 1, minWidth: 280, p: { xs: 2, sm: 3 }, backgroundColor: 'rgba(255,255,255,0.95)', minHeight: 320, position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: 8, right: 8, width: 40, display: 'flex', justifyContent: 'flex-end' }}>
              {isCustomPreset ? (
                <IconButton onClick={handleUpdateConfig} color="primary" title="Save preset" aria-label="Save preset">
                  <span style={{ fontSize: 20 }}>💾</span>
                </IconButton>
              ) : null}
            </Box>
            <Typography variant="h6" gutterBottom>CES Write Limits</Typography>
            {selectedConfig === 'Default' && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                These values are for CES DB instance 4x.large
              </Typography>
            )}
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Preset</InputLabel>
              <Select value={safeSelectedConfig} label="Preset" onChange={(e) => setSelectedConfig(e.target.value)}>
                <MenuItem value="Default">Default</MenuItem>
                {savedConfigs.map(c => <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TableContainer>
              <Table size="small">
                <TableHead><TableRow><TableCell>Entity</TableCell><TableCell align="right">TPM</TableCell></TableRow></TableHead>
                <TableBody>
                  {ENTITY_TYPES.map(entity => (
                    <TableRow key={entity}>
                      <TableCell>{entity}</TableCell>
                      <TableCell align="right">
                        <TextField type="text" inputMode="numeric" size="small" value={cesLimits[entity] ?? ''} onChange={(e) => handleTPMChange(entity, e.target.value)} sx={{ width: 100 }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField size="small" placeholder="Preset name" value={newConfigName} onChange={(e) => setNewConfigName(e.target.value)} sx={{ flex: 1, minWidth: 120 }} />
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', minWidth: 90, justifyContent: 'flex-end' }}>
                <Button variant="contained" onClick={handleCreateConfig} size="small">Create</Button>
                {isCustomPreset && (
                  <IconButton color="error" onClick={handleDeleteConfig} size="small" title="Delete preset" aria-label="Delete preset">✕</IconButton>
                )}
              </Box>
            </Box>
            </Paper>
          </Box>
        </Box>
      </Box>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} message={snackbar.message} />
    </Box>
  );
}

export default App;
