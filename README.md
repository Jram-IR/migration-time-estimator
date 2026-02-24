# Migration Estimator

A React web application that calculates estimated migration time based on configuration parameters including batch size, concurrency, delay, CES write limits, and entity counts.

## Features

- **Configuration Sliders**: Batch Size (1-500), Concurrency (1-200), Delay (in seconds or minutes)
- **CES Write Limits**: Editable TPM values for Company, Site, and Contact (for 4x.large instance)
- **Preset Management**: Save and switch between CES limit configurations (stored in cookies)
- **Entity Configuration**: Duration per entity type, total counts, buffer time %, max writes per entity
- **Real-time Estimate**: Live migration time calculation displayed in hh:mm:ss format
- **CES Limit Warnings**: Alerts when effective rate exceeds 80% of CES limits (< 20% leeway)

## Getting Started

```bash
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

## Build

```bash
npm run build
```

## Tech Stack

- React 19
- Vite
- Material UI (MUI)
- JavaScript
