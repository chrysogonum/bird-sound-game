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

function App() {
  return (
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
    </Routes>
  );
}

export default App;
