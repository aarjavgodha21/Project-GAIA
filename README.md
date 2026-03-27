# GAIA - AI for Ecological Balance & Sustainability

A modern web dashboard that shows how GAIA predicts ecological balance for different locations using AI and data visualization.

## Features

- **Home/Landing Page**: Beautiful animated homepage with project title, tagline, and navigation
- **Sustainability Checker**: Location input panel with sustainability score cards (Coming Soon)
- **Predictions Dashboard**: Graphs showing CO₂/AQI trends and predictions (Coming Soon)
- **Interactive Maps**: Leaflet-based maps for geographic data visualization (Coming Soon)
- **Risk Alerts**: Real-time ecological risk detection and warnings (Coming Soon)

## Tech Stack

- **Frontend Framework**: React 19 + TypeScript
- **Build Tool**: Vite (with Rolldown experimental)
- **Routing**: React Router DOM
- **Animations**: Framer Motion
- **Maps**: Leaflet + React Leaflet
- **Styling**: CSS3 with modern gradients and animations

## Getting Started

### Prerequisites

- Node.js (LTS version recommended)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Run the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173/`

### Build

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Deploy to Vercel

This project is ready for Vercel static deployment using the Vite build output.

### Option 1: Deploy from GitHub (Recommended)

1. Push your latest code to GitHub.
2. Go to Vercel and click **Add New -> Project**.
3. Import your repository.
4. Use these project settings:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
5. Click **Deploy**.

If your repository contains multiple app folders, set **Root Directory** to the folder containing `package.json` for the app you want to deploy.

### Option 2: Deploy with Vercel CLI

```bash
npm i -g vercel
vercel login
vercel
```

For production deployment:

```bash
vercel --prod
```

### Important: SPA Routing

This app uses React Router. Direct URL access (for example `/predictions`) requires a rewrite to `index.html` in production. The included `vercel.json` already handles this.

### Environment Variables

Currently this project uses no required secret API keys for the core flow. If you add keys later:

1. Add them in Vercel Project Settings -> Environment Variables.
2. Reference them with `import.meta.env` in the app.
3. Redeploy after updating variables.

## Project Structure

```
src/
├── pages/
│   ├── Home.tsx           # Landing page with animations
│   ├── Home.css           # Home page styles
│   ├── Sustainability.tsx # Sustainability checker (placeholder)
│   └── Predictions.tsx    # Predictions dashboard (placeholder)
├── App.tsx                # Main app with routing
├── App.css                # Global app styles
└── index.css              # Root styles and variables
```

## Future Enhancements

- ML model integration for predictions
- Real-time data fetching
- Location-based sustainability scoring
- Interactive charts (Chart.js/Recharts)
- User authentication
- Data export functionality
