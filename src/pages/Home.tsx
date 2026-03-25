import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import './Home.css';

type ParticleConfig = {
  initialX: number;
  initialY: number;
  animateX: number;
  animateY: number;
  scale: number;
  duration: number;
};

const PARTICLE_COUNT = 20;

const PARTICLE_CONFIGS: ParticleConfig[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const seed = i + 1;
  const initialX = (seed * 37) % 100;
  const initialY = (seed * 53) % 100;
  const animateX = (seed * 71 + 17) % 100;
  const animateY = (seed * 89 + 29) % 100;
  const scale = 0.5 + ((seed * 19) % 50) / 100;
  const duration = 10 + ((seed * 23) % 20);

  return {
    initialX,
    initialY,
    animateX,
    animateY,
    scale,
    duration,
  };
});

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      {/* Animated background particles */}
      <div className="background-animation">
        {PARTICLE_CONFIGS.map((particle, i) => (
          <motion.div
            key={i}
            className="particle"
            initial={{ 
              x: `${particle.initialX}vw`, 
              y: `${particle.initialY}vh`,
              scale: particle.scale,
            }}
            animate={{
              x: `${particle.animateX}vw`,
              y: `${particle.animateY}vh`,
              scale: particle.scale,
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              repeatType: "reverse"
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <motion.div 
        className="content"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
      >
        {/* Logo/Icon */}
        <motion.div 
          className="logo-container"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ 
            duration: 0.8, 
            delay: 0.2,
            type: "spring",
            stiffness: 200
          }}
        >
          <div className="logo">
            <svg viewBox="0 0 100 100" className="leaf-icon">
              <defs>
                <linearGradient id="leafGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
              </defs>
              {/* Outer circle border */}
              <motion.circle
                cx="50"
                cy="50"
                r="45"
                stroke="#10b981"
                strokeWidth="2"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
              />
              {/* Group for tilted leaf */}
              <motion.g
                style={{ transformOrigin: '50px 50px' }}
                initial={{ rotate: 0 }}
                animate={{ rotate: 210 }}
                transition={{ duration: 4, ease: "easeInOut", delay: 0.3 }}
              >
                {/* Main leaf shape drawn as a line */}
                <motion.path
                  d="M 50 20 C 60 30, 65 40, 65 50 C 65 65, 58 75, 50 80 C 42 75, 35 65, 35 50 C 35 40, 40 30, 50 20 Z"
                  stroke="#10b981"
                  fill="none"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 2, ease: "easeInOut", delay: 0.3 }}
                />
                {/* Leaf center vein */}
                <motion.path
                  d="M 50 20 Q 50 50, 50 80"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  fill="none"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.2, delay: 1.2 }}
                  opacity="0.7"
                />
                {/* Left side veins */}
                <motion.path
                  d="M 45 30 Q 40 35, 38 45 M 46 45 Q 40 48, 38 58 M 47 65 Q 42 70, 40 75"
                  stroke="#10b981"
                  strokeWidth="1"
                  fill="none"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1, delay: 1.5 }}
                  opacity="0.5"
                />
                {/* Right side veins */}
                <motion.path
                  d="M 55 30 Q 60 35, 62 45 M 54 45 Q 60 48, 62 58 M 53 65 Q 58 70, 60 75"
                  stroke="#10b981"
                  strokeWidth="1"
                  fill="none"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1, delay: 1.5 }}
                  opacity="0.5"
                />
              </motion.g>
            </svg>
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1 
          className="title"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
        >
          GAIA
        </motion.h1>

        {/* Tagline */}
        <motion.p 
          className="tagline"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
        >
          AI for Ecological Balance & Sustainability
        </motion.p>

        {/* Buttons */}
        <motion.div 
          className="button-group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
        >
          <motion.button
            className="btn btn-primary"
            onClick={() => navigate('/sustainability')}
            whileHover={{ scale: 1.05, boxShadow: "0 0 25px rgba(16, 185, 129, 0.5)" }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="btn-icon">🌿</span>
            <span className="btn-text">Check Sustainability</span>
          </motion.button>

          <motion.button
            className="btn btn-secondary"
            onClick={() => navigate('/predictions')}
            whileHover={{ scale: 1.05, boxShadow: "0 0 25px rgba(59, 130, 246, 0.5)" }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="btn-icon">🔮</span>
            <span className="btn-text">View Predictions</span>
          </motion.button>
        </motion.div>

        {/* Feature highlights */}
        <motion.div 
          className="feature-highlights"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.2 }}
        >
          <div className="feature-item">
            <span className="feature-dot" />
            <span className="feature-label">Real-time Analysis</span>
          </div>
          <div className="feature-divider" />
          <div className="feature-item">
            <span className="feature-dot" />
            <span className="feature-label">AI Predictions</span>
          </div>
          <div className="feature-divider" />
          <div className="feature-item">
            <span className="feature-dot" />
            <span className="feature-label">Data Insights</span>
          </div>
        </motion.div>

        <motion.div
          className="quick-guide"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 1.35 }}
        >
          <div className="guide-card">
            <h3>1. Explore Live Map</h3>
            <p>Track city-level sustainability across India with map markers and real-time air-quality context.</p>
          </div>
          <div className="guide-card">
            <h3>2. Select Forecast City</h3>
            <p>Pick a city with state/district metadata so predictions are clearly tied to the correct location.</p>
          </div>
          <div className="guide-card">
            <h3>3. Review Risk Outlook</h3>
            <p>Use trends, confidence, and metric ranges to prioritize areas needing intervention.</p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Home;
