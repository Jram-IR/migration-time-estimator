import { useState, useEffect, useMemo } from 'react';
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
  calculateUpperLimit,
  calculateGrossDuration,
  calculateEffectiveRate,
  needsWarning,
  formatMigrationTime,
} from './utils/calculations';
import { getCESLimitsFromCookie, addCESLimitToCookie } from './utils/cookieStorage';
import './App.css';

const ENTITY_TYPES = ['Company', 'Site', 'Contact'];
const DEFAULT_TPM = { Company: 5600, Site: 7300, Contact: 10000 };
const DEFAULT_DURATIONS = { Company: 20, Site: 5, Contact: 5 };
const DEFAULT_TOTALS = { Company: 0, Site: 0, Contact: 0 };

function App() {
  // Component 1: Sliders
  const [batchSize, setBatchSize] = useState(100);
  const [concurrency, setConcurrency] = useState(50);
  const [delay, setDelay] = useState(30);
  const [delayUnit, setDelayUnit] = useState('sec'); // 'sec' or 'min'

  // Component 2: CES Limits
  const [cesLimits, setCesLimits] = useState({ Company: 5600, Site: 7300, Contact: 10000 });
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState('Default');
  const [newConfigName, setNewConfigName] = useState('');

  // Component 3: Durations and totals
  const [durations, setDurations] = useState(DEFAULT_DURATIONS);
  const [totals, setTotals] = useState(DEFAULT_TOTALS);

  // Elements 1 & 2
  const [bufferTime, setBufferTime] = useState(0);
  const [maxWrites, setMaxWrites] = useState(16);

  // Warnings
  const [warningSnackbar, setWarningSnackbar] = useState({ open: false, message: '' });
  // Load saved configs from cookie on mount
  useEffect(() => {
    const saved = getCESLimitsFromCookie();
    if (saved && saved.length > 0) {
      setSavedConfigs(saved);
      setSelectedConfig(saved[0].name);
      setCesLimits(saved[0].limits);
    } else {
      setSelectedConfig('Default');
    }
  }, []);

  // Load config when selection changes
  useEffect(() => {
    if (selectedConfig === 'Default') {
      setCesLimits(DEFAULT_TPM);
    } else if (selectedConfig && savedConfigs.length > 0) {
      const config = savedConfigs.find(c => c.name === selectedConfig);
      if (config) {
        setCesLimits(config.limits);
      }
    }
  }, [selectedConfig, savedConfigs]);

  const delayInSeconds = delayUnit === 'min' ? delay * 60 : delay;

  // Calculate migration time and rates
  const { migrationTime, effectiveRates, upperLimits, hasWarnings } = useMemo(() => {
    const rates = {};
    const limits = {};
    const entityWarnings = [];

    ENTITY_TYPES.forEach(entity => {
      const tpm = cesLimits[entity] || 0;
      const upperLimit = calculateUpperLimit(tpm, maxWrites);
      limits[entity] = upperLimit;

      const grossDuration = calculateGrossDuration(
        batchSize,
        concurrency,
        durations[entity] || 0,
        delayInSeconds
      );
      const effectiveRate = calculateEffectiveRate(batchSize, grossDuration);
      rates[entity] = effectiveRate;

      if (needsWarning(effectiveRate, upperLimit)) {
        entityWarnings.push(`${entity}: Effective rate (${Math.round(effectiveRate)}/min) exceeds 80% of CES limit (${upperLimit}/min). Consider reducing batch size or concurrency.`);
      }
    });

    // Calculate total migration time
    let totalMinutes = 0;
    ENTITY_TYPES.forEach(entity => {
      const count = totals[entity] || 0;
      const rate = rates[entity] || 1;
      if (count > 0 && rate > 0) {
        totalMinutes += count / rate;
      }
    });

    // Apply buffer
    const bufferMultiplier = 1 + (bufferTime / 100);
    totalMinutes *= bufferMultiplier;

    return {
      migrationTime: formatMigrationTime(totalMinutes),
      effectiveRates: rates,
      upperLimits: limits,
      hasWarnings: entityWarnings.length > 0,
      warnings: entityWarnings,
    };
  }, [batchSize, concurrency, delayInSeconds, cesLimits, durations, totals, maxWrites, bufferTime]);

  const handleSaveConfig = () => {
    if (!newConfigName.trim()) return;
    const config = {
      name: newConfigName.trim(),
      limits: { ...cesLimits },
    };
    const updated = addCESLimitToCookie(config);
    setSavedConfigs(updated);
    setSelectedConfig(config.name);
    setNewConfigName('');
    setWarningSnackbar({ open: true, message: `Saved "${config.name}"` });
  };

  const handleTPMChange = (entity, value) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setCesLimits(prev => ({ ...prev, [entity]: num }));
    } else if (value === '') {
      setCesLimits(prev => ({ ...prev, [entity]: 0 }));
    }
  };

  const handleDurationChange = (entity, value) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setDurations(prev => ({ ...prev, [entity]: num }));
    } else if (value === '') {
      setDurations(prev => ({ ...prev, [entity]: 0 }));
    }
  };

  const handleTotalChange = (entity, value) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setTotals(prev => ({ ...prev, [entity]: num }));
    } else if (value === '') {
      setTotals(prev => ({ ...prev, [entity]: 0 }));
    }
  };

  const handleBufferChange = (value) => {
    if (value === '') {
      setBufferTime(0);
    } else {
      const num = parseInt(value, 10);
      if (!isNaN(num) && num >= 0) setBufferTime(num);
    }
  };

  const handleMaxWritesChange = (value) => {
    if (value === '') {
      setMaxWrites(1);
    } else {
      const num = parseInt(value, 10);
      if (!isNaN(num) && num >= 1) setMaxWrites(num);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        py: 4,
        px: 2,
      }}
    >
      <Typography
        variant="h4"
        component="h1"
        sx={{
          color: 'white',
          textAlign: 'center',
          mb: 4,
          fontWeight: 700,
          letterSpacing: 1,
        }}
      >
        Migration Estimator
      </Typography>

      <Grid container spacing={3} sx={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Component 1: Sliders */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, backgroundColor: 'rgba(255,255,255,0.95)' }}>
            <Typography variant="h6" gutterBottom>
              Configuration
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Typography gutterBottom>Batch Size: {batchSize}</Typography>
              <Slider
                value={batchSize}
                onChange={(_, v) => setBatchSize(v)}
                min={1}
                max={500}
                valueLabelDisplay="auto"
                color="primary"
              />
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography gutterBottom>Concurrency: {concurrency}</Typography>
              <Slider
                value={concurrency}
                onChange={(_, v) => setConcurrency(v)}
                min={1}
                max={200}
                valueLabelDisplay="auto"
                color="primary"
              />
            </Box>
            <Box>
              <Typography gutterBottom>
                Delay: {delay} {delayUnit}
              </Typography>
              <Slider
                value={delay}
                onChange={(_, v) => setDelay(v)}
                min={0}
                max={delayUnit === 'sec' ? 300 : 10}
                valueLabelDisplay="auto"
                color="primary"
              />
              <FormControl component="fieldset" sx={{ mt: 1 }}>
                <RadioGroup
                  row
                  value={delayUnit}
                  onChange={(e) => setDelayUnit(e.target.value)}
                >
                  <FormControlLabel value="sec" control={<Radio size="small" />} label="Seconds" />
                  <FormControlLabel value="min" control={<Radio size="small" />} label="Minutes" />
                </RadioGroup>
              </FormControl>
            </Box>
          </Paper>
        </Grid>

        {/* Component 2: CES Write Limits */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.95)' }}>
            <Typography variant="h6" gutterBottom>
              CES Write Limits
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              These values are for CES DB instance 4x.large
            </Typography>

            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Preset</InputLabel>
              <Select
                value={selectedConfig || 'Default'}
                label="Preset"
                onChange={(e) => setSelectedConfig(e.target.value)}
              >
                <MenuItem value="Default">Default</MenuItem>
                {savedConfigs.map(c => (
                  <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Entity</TableCell>
                    <TableCell align="right">TPM</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ENTITY_TYPES.map(entity => (
                    <TableRow key={entity}>
                      <TableCell>{entity}</TableCell>
                      <TableCell align="right">
                        <TextField
                          type="number"
                          size="small"
                          value={cesLimits[entity] ?? ''}
                          onChange={(e) => handleTPMChange(entity, e.target.value)}
                          inputProps={{ min: 0, step: 1 }}
                          sx={{ width: 80 }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="Config name"
                value={newConfigName}
                onChange={(e) => setNewConfigName(e.target.value)}
                sx={{ flex: 1, minWidth: 100 }}
              />
              <Button variant="contained" onClick={handleSaveConfig} size="small">
                Save
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Component 3 & Elements: Durations, Totals, Buffer, Max Writes */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, backgroundColor: 'rgba(255,255,255,0.95)' }}>
            <Typography variant="h6" gutterBottom>
              Entity Configuration
            </Typography>
            <Grid container spacing={3}>
              {ENTITY_TYPES.map(entity => (
                <Grid item xs={12} sm={4} key={entity}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" color="primary">
                        {entity}
                      </Typography>
                      <TextField
                        fullWidth
                        size="small"
                        label="Duration (sec)"
                        type="number"
                        value={durations[entity] ?? ''}
                        onChange={(e) => handleDurationChange(entity, e.target.value)}
                        inputProps={{ min: 0 }}
                        sx={{ mt: 1 }}
                      />
                      <TextField
                        fullWidth
                        size="small"
                        label="Total count"
                        type="number"
                        value={totals[entity] ?? ''}
                        onChange={(e) => handleTotalChange(entity, e.target.value)}
                        inputProps={{ min: 0 }}
                        sx={{ mt: 1 }}
                      />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Buffer time (%)"
                  type="number"
                  value={bufferTime}
                  onChange={(e) => handleBufferChange(e.target.value)}
                  inputProps={{ min: 0, step: 1 }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Max writes per entity"
                  type="number"
                  value={maxWrites}
                  onChange={(e) => handleMaxWritesChange(e.target.value)}
                  inputProps={{ min: 1, step: 1 }}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Component 4: Migration Time Display */}
        <Grid item xs={12}>
          <Paper
            sx={{
              p: 4,
              textAlign: 'center',
              backgroundColor: hasWarnings ? 'rgba(255, 193, 7, 0.2)' : 'rgba(76, 175, 80, 0.2)',
              border: 2,
              borderColor: hasWarnings ? 'warning.main' : 'primary.main',
            }}
          >
            <Typography variant="overline" color="text.secondary">
              Estimated Migration Time
            </Typography>
            <Typography
              variant="h2"
              component="div"
              sx={{
                fontWeight: 700,
                color: 'primary.main',
                fontFamily: 'monospace',
                letterSpacing: 4,
                mt: 1,
              }}
            >
              {migrationTime}
            </Typography>
            {hasWarnings && (
              <Alert severity="warning" sx={{ mt: 2, textAlign: 'left' }}>
                <Typography variant="subtitle2">CES limit warning:</Typography>
                <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                  {ENTITY_TYPES.map(entity => {
                    const rate = effectiveRates[entity] || 0;
                    const limit = upperLimits[entity] || 0;
                    if (needsWarning(rate, limit)) {
                      return (
                        <li key={entity}>
                          {entity}: Effective rate ({Math.round(rate)}/min) exceeds 80% of limit ({limit}/min). Less than 20% leeway.
                        </li>
                      );
                    }
                    return null;
                  })}
                </ul>
              </Alert>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Snackbar
        open={warningSnackbar.open}
        autoHideDuration={3000}
        onClose={() => setWarningSnackbar({ ...warningSnackbar, open: false })}
        message={warningSnackbar.message}
      />
    </Box>
  );
}

export default App;
