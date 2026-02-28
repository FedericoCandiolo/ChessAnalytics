import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useChessData } from './hooks/useChessData';
import Header from './components/Header';
import FilterPanel from './components/FilterPanel';
import FilterDrawer from './components/FilterDrawer';
import LoadingOverlay from './components/LoadingOverlay';
import MobileFAB from './components/MobileFAB';
import GameHistory from './components/GameHistory';
import ChartSlider from './components/ChartSlider';

import ResultsPieChart from './components/ResultsPieChart';
import OpeningsBarChart from './components/OpeningsBarChart';
import EloLineChart from './components/EloLineChart';
import AccuracyChart from './components/AccuracyChart';
import ColorPerformanceChart from './components/ColorPerformanceChart';
import MonthlyTrendChart from './components/MonthlyTrendChart';
import AccuracyVsEloScatter from './components/AccuracyVsEloScatter';
import OpeningBubblesChart from './components/OpeningBubblesChart';
import CalendarChart from './components/CalendarChart';
import RadialWeekdayChart from './components/RadialWeekdayChart';

function App() {
  const { t } = useTranslation();
  const [isFilterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [isHistoryDrawerOpen, setHistoryDrawerOpen] = useState(false);

  // Layout detection: desktop (≥1100px), portrait (h > w), mobile landscape (default)
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1100);
  const [isPortrait, setIsPortrait] = useState(() => window.innerHeight > window.innerWidth);

  useEffect(() => {
    const handler = () => {
      setIsDesktop(window.innerWidth >= 1100);
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const {
    setUsername, loading, error,
    filters, setFilters, toggleMultiFilter, clearFilters,
    yearsAvailable, familiesAvailable, openingsAvailable,
    timeClassesAvailable, rulesAvailable, monthsAvailable, ratedAvailable,
    activeYears, activeTimeClasses, activeColors, activeResults, activeRules, activeMonths, activeRated,
    filteredData
  } = useChessData();

  const { stats } = filteredData;

  const filterProps = {
    filters, setFilters, toggleMultiFilter, clearFilters,
    yearsAvailable, familiesAvailable, openingsAvailable,
    timeClassesAvailable, rulesAvailable, monthsAvailable, ratedAvailable,
    activeYears, activeTimeClasses, activeColors, activeResults, activeRules, activeMonths, activeRated
  };

  // ── Chart elements ───────────────────────────────────────────────────────
  const pieChart      = <ResultsPieChart data={stats.pie} winRate={stats.winRate} />;
  const openingsChart = <OpeningsBarChart data={stats.stackedOpenings} />;
  const eloChart      = <EloLineChart data={stats.elo} />;
  const accChart      = <AccuracyChart data={stats.accuracyBuckets} />;
  const colorChart    = <ColorPerformanceChart data={stats.colorStats} />;
  const monthlyChart  = <MonthlyTrendChart data={stats.monthlyTrend} />;
  const scatterChart  = <AccuracyVsEloScatter data={stats.accuracyVsElo} />;
  const bubblesChart  = <OpeningBubblesChart data={stats.openingBubbles} />;
  const calendarChart = <CalendarChart data={stats.calendarData} />;
  const radialChart   = <RadialWeekdayChart data={stats.weekdayData} />;

  // ── Desktop slides (width ≥ 1100): 3 or 4 charts per slide ──────────────
  const desktopSlides = [
    {
      label: `${t('slides.results')} + ${t('slides.elo')}`,
      node: (
        <div className="slide-desktop-4">
          {pieChart}
          {openingsChart}
          {eloChart}
          {bubblesChart}
        </div>
      )
    },
    {
      label: `${t('slides.accuracy')} + ${t('slides.scatter')}`,
      node: (
        <div className="slide-desktop-3">
          {accChart}
          {colorChart}
          {scatterChart}
        </div>
      )
    },
    {
      label: `${t('slides.calendar')} + ${t('slides.monthly')}`,
      node: (
        <div className="slide-desktop-3">
          {calendarChart}
          {radialChart}
          {monthlyChart}
        </div>
      )
    }
  ];

  // ── Portrait slides (h > w): 2 charts stacked per slide ─────────────────
  const portraitSlides = [
    { label: t('slides.results'),  node: <div className="slide-col-2">{pieChart}{openingsChart}</div> },
    { label: t('slides.elo'),      node: <div className="slide-col-2">{eloChart}{bubblesChart}</div> },
    { label: t('slides.accuracy'), node: <div className="slide-col-2">{accChart}{colorChart}</div> },
    { label: t('slides.scatter'),  node: <div className="slide-col-2">{scatterChart}{calendarChart}</div> },
    { label: t('slides.radial'),   node: <div className="slide-col-2">{radialChart}{monthlyChart}</div> }
  ];

  // ── Mobile landscape slides: 1 chart per slide ──────────────────────────
  const mobileSlides = [
    { label: t('slides.results'),          node: pieChart },
    { label: t('charts.openingSuccess'),   node: openingsChart },
    { label: t('slides.elo'),              node: eloChart },
    { label: t('slides.bubbles'),          node: bubblesChart },
    { label: t('slides.accuracy'),         node: accChart },
    { label: t('charts.colorPerformance'), node: colorChart },
    { label: t('slides.scatter'),          node: scatterChart },
    { label: t('slides.calendar'),         node: calendarChart },
    { label: t('slides.radial'),           node: radialChart },
    { label: t('slides.monthly'),          node: monthlyChart }
  ];

  const slides = isDesktop ? desktopSlides : isPortrait ? portraitSlides : mobileSlides;
  const layoutKey = isDesktop ? 'desktop' : isPortrait ? 'portrait' : 'mobile';

  return (
    <div className="grid-layout">
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
        currentElo={stats.currentElo}
        gamesCount={filteredData.games.length}
        onUsernameSubmit={setUsername}
        mainTimeClass={stats.mainTimeClass}
        currentEloByMode={stats.currentEloByMode}
        maxEloByMode={stats.maxEloByMode}
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
        <GameHistory games={filteredData.games} isDrawer onClose={() => setHistoryDrawerOpen(false)} />
      </div>

      <main className="content">
        <ChartSlider key={layoutKey} slides={slides} />
      </main>

      <GameHistory games={filteredData.games} />

      <footer className="footer">ChessAnalytics © {new Date().getFullYear()}</footer>
    </div>
  );
}

export default App;
