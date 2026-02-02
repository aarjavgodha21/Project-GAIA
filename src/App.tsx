import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Sustainability from './pages/Sustainability';
import Predictions from './pages/Predictions';
import Footer from './components/Footer';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sustainability" element={<Sustainability />} />
        <Route path="/predictions" element={<Predictions />} />
      </Routes>
      <Footer />
    </Router>
  );
}

export default App;
