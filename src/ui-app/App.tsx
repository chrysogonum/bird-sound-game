import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import MainMenu from './screens/MainMenu';
import PackSelect from './screens/PackSelect';
import LevelSelect from './screens/LevelSelect';
import PreRoundPreview from './screens/PreRoundPreview';
import CustomPackBuilder from './screens/CustomPackBuilder';
import GameplayScreen from './game/GameplayScreen';
import RoundSummary from './screens/RoundSummary';
import Settings from './screens/Settings';
import Progress from './screens/Progress';
import Help from './screens/Help';
import Privacy from './screens/Privacy';
import CookieConsent from './components/CookieConsent';

// Tablet scaling: use CSS zoom to make everything larger
const TABLET_ZOOM = 1.4;
const TABLET_MIN_WIDTH = 768;

function App() {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const updateZoom = () => {
      const width = window.innerWidth;
      if (width >= TABLET_MIN_WIDTH) {
        setZoom(TABLET_ZOOM);
      } else {
        setZoom(1);
      }
    };

    updateZoom();
    window.addEventListener('resize', updateZoom);
    return () => window.removeEventListener('resize', updateZoom);
  }, []);

  // Apply zoom to the root element via CSS
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * zoom}px`;
    return () => {
      document.documentElement.style.fontSize = '16px';
    };
  }, [zoom]);

  return (
    <div style={{
      zoom: zoom,
      width: '100%',
      height: '100%',
      overflow: 'auto',
    }}>
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/pack-select" element={<PackSelect />} />
        <Route path="/level-select" element={<LevelSelect />} />
        <Route path="/preview" element={<PreRoundPreview />} />
        <Route path="/custom-pack" element={<CustomPackBuilder />} />
        <Route path="/gameplay" element={<GameplayScreen />} />
        <Route path="/summary" element={<RoundSummary />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/help" element={<Help />} />
        <Route path="/privacy" element={<Privacy />} />
      </Routes>
      <CookieConsent />
    </div>
  );
}

export default App;
