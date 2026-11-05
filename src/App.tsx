import { VideoProvider } from './contexts/VideoContext';
import { Header } from './components/Header/Header';
import { NowPlaying } from './components/NowPlaying/NowPlaying';
import { ArchivesPage } from './components/Archives/ArchivesPage';
import { useRoute } from './hooks/useRoute';
import styles from './App.module.css';

function App() {
  const route = useRoute();
  return (
    <VideoProvider>
      <div className={`${styles.app} ${route === 'archives' ? styles.scroll : ''}`}>
        <Header />
        {/* The viewer stays mounted so streams keep playing while Archives is open. */}
        <div className={styles.view} hidden={route !== 'watch'}>
          <NowPlaying />
        </div>
        {route === 'archives' && <ArchivesPage />}
      </div>
    </VideoProvider>
  );
}

export default App;
