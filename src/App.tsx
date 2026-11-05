import { VideoProvider } from './contexts/VideoContext';
import { Header } from './components/Header/Header';
import { NowPlaying } from './components/NowPlaying/NowPlaying';
import styles from './App.module.css';

function App() {
  return (
    <VideoProvider>
      <div className={styles.app}>
        <Header />
        <NowPlaying />
      </div>
    </VideoProvider>
  );
}

export default App;
