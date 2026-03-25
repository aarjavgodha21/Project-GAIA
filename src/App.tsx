import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Footer from './components/Footer';
import './App.css';

const Sustainability = lazy(() => import('./pages/Sustainability'));
const Predictions = lazy(() => import('./pages/Predictions'));

const AppContent = () => {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <>
      <Suspense fallback={<div className="route-loading">Loading page...</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sustainability" element={<Sustainability />} />
          <Route path="/predictions" element={<Predictions />} />
        </Routes>
      </Suspense>
      {!isHome && <Footer />}
    </>
  );
};

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
