import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useChessData } from './hooks/useChessData';
import Header from './components/Header';
import FilterPanel from './components/FilterPanel';
import FilterDrawer from './components/FilterDrawer';
import LoadingOverlay from './components/LoadingOverlay';
import MobileFAB from './components/MobileFAB';
import ResultsPieChart from './components/ResultsPieChart';
import OpeningsBarChart from './components/OpeningsBarChart';
import EloLineChart from './components/EloLineChart';
import ChartTabs from './components/ChartTabs';
import GameHistory from './components/GameHistory';

function App() {
  const { t } = useTranslation();
  const [isFilterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [isHistoryDrawerOpen, setHistoryDrawerOpen] = useState(false);

  const {
    setUsername,
    loading,
    error,
    filters,
    setFilters,
    toggleMultiFilter,
    clearFilters,
    yearsAvailable,
    familiesAvailable,
    filteredData
  } = useChessData();

  const filterProps = { filters, setFilters, toggleMultiFilter, clearFilters, yearsAvailable, familiesAvailable };

  return (
    <div className="grid-layout" style={{ '--color-item-bg': '#2d333f' }}>
      {loading && <LoadingOverlay />}

      {error && (
        <div style={{
          position: 'fixed', top: '5rem', left: '50%', transform: 'translateX(-50%)',
          background: '#450a0a', border: '1px solid #ef4444', color: '#fca5a5',
          padding: '0.625rem 1.25rem', borderRadius: '0.5rem', fontSize: '0.8rem',
          zIndex: 1500, maxWidth: '90vw', textAlign: 'center'
        }}>
          {t('error')}
        </div>
      )}

      <Header
        currentElo={filteredData.stats.currentElo}
        gamesCount={filteredData.games.length}
        onUsernameSubmit={setUsername}
      />

      <FilterPanel {...filterProps} />

      <MobileFAB
        onFilterOpen={() => setFilterDrawerOpen(true)}
        onHistoryOpen={() => setHistoryDrawerOpen(true)}
      />

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        {...filterProps}
      />

      {isHistoryDrawerOpen && (
        <div className="drawer-overlay" onClick={() => setHistoryDrawerOpen(false)} />
      )}
      <div className={`history-drawer${isHistoryDrawerOpen ? ' open' : ''}`}>
        <GameHistory
          games={filteredData.games}
          isDrawer
          onClose={() => setHistoryDrawerOpen(false)}
        />
      </div>

      <main className="content">
        {/* Row 1: fits on screen */}
        <div className="charts-row-top">
          <ResultsPieChart data={filteredData.stats.pie} winRate={filteredData.stats.winRate} />
          <OpeningsBarChart data={filteredData.stats.stackedOpenings} />
        </div>

        {/* Row 2: fits on screen */}
        <EloLineChart data={filteredData.stats.elo} />

        {/* Row 3: tabbed — scroll down to reveal */}
        <ChartTabs
          accuracyData={filteredData.stats.accuracyBuckets}
          colorData={filteredData.stats.colorStats}
          monthlyData={filteredData.stats.monthlyTrend}
        />
      </main>

      <GameHistory games={filteredData.games} />

      <footer className="footer">ChessAnalytics © {new Date().getFullYear()}</footer>
    </div>
  );
}

export default App;
