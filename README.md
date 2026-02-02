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
