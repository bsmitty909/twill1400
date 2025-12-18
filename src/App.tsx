import { VideoProvider } from './contexts/VideoContext';
import { Header } from './components/Header/Header';
import { NowPlaying } from './components/NowPlaying/NowPlaying';
import './index.css';

function App() {
  return (
    <VideoProvider>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        overflow: 'auto'
      }}>
        <Header />
        <NowPlaying />
      </div>
    </VideoProvider>
  );
}

export default App;
