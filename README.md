# Migration Estimator

A React web application that calculates estimated migration time based on configuration parameters including batch size, concurrency, delay, CES write limits, and entity counts.

## Features

- **Configuration Sliders**: Batch Size (1-500), Concurrency (1-200), Delay (in seconds or minutes)
- **CES Write Limits**: Editable TPM values for Company, Site, and Contact (for 4x.large instance)
- **Preset Management**: Save and switch between CES limit configurations (stored in cookies)
- **Entity Configuration**: Duration per entity type, total counts, buffer time %, max writes per entity
- **Real-time Estimate**: Live migration time calculation displayed in dd:hh:mm:ss format (D=days, H=hours, M=minutes, S=seconds)
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

## Deploy to Vercel

This app is configured for [Vercel](https://vercel.com) deployment and can be deployed worldwide:

1. **Via Vercel Dashboard** (recommended):
   - Push this repo to GitHub
   - Go to [vercel.com](https://vercel.com) and sign in
   - Click "Add New Project" and import your repository
   - Vercel will auto-detect the Vite config; deploy with the default settings

2. **Via Vercel CLI**:
   ```bash
   npm i -g vercel
   vercel
   ```

The `vercel.json` config specifies the build command, output directory, and SPA routing.

## Tech Stack

- React 19
- Vite
- Material UI (MUI)
- JavaScript
