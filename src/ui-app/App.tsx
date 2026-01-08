import { Routes, Route } from 'react-router-dom';
import MainMenu from './screens/MainMenu';
import PackSelect from './screens/PackSelect';
import Gameplay from './screens/Gameplay';
import RoundSummary from './screens/RoundSummary';
import Settings from './screens/Settings';
import Progress from './screens/Progress';

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainMenu />} />
      <Route path="/pack-select" element={<PackSelect />} />
      <Route path="/gameplay" element={<Gameplay />} />
      <Route path="/summary" element={<RoundSummary />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/progress" element={<Progress />} />
    </Routes>
  );
}

export default App;
