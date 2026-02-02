import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      {/* Animated background particles */}
      <div className="background-animation">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="particle"
            initial={{ 
              x: Math.random() * window.innerWidth, 
              y: Math.random() * window.innerHeight,
              scale: Math.random() * 0.5 + 0.5
            }}
            animate={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              scale: Math.random() * 0.5 + 0.5
            }}
            transition={{
              duration: Math.random() * 20 + 10,
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
            <svg viewBox="0 0 100 100" className="earth-icon">
              <motion.circle
                cx="50"
                cy="50"
                r="45"
                stroke="url(#gradient)"
                strokeWidth="2"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, ease: "easeInOut" }}
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
              <motion.path
                d="M 30 50 Q 50 30, 70 50 T 70 70"
                stroke="#10b981"
                strokeWidth="2"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, delay: 0.5 }}
              />
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

        {/* Floating info cards */}
        <motion.div 
          className="info-cards"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.2 }}
        >
          <motion.div 
            className="info-card"
            whileHover={{ y: -5 }}
          >
            <div className="card-icon">🌍</div>
            <div className="card-text">Real-time Analysis</div>
          </motion.div>
          <motion.div 
            className="info-card"
            whileHover={{ y: -5 }}
          >
            <div className="card-icon">🤖</div>
            <div className="card-text">AI Predictions</div>
          </motion.div>
          <motion.div 
            className="info-card"
            whileHover={{ y: -5 }}
          >
            <div className="card-icon">📈</div>
            <div className="card-text">Data Insights</div>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Home;
