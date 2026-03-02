import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useChessData } from './hooks/useChessData';
import { generatePDF } from './utils/exportPDF';
import { ELO_COLORS } from './constants';
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
import OpeningBubblesChart from './components/OpeningBubblesChart';
import CalendarChart from './components/CalendarChart';

function App() {
  const { t } = useTranslation();
  const [isFilterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [isHistoryDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('chess-theme') || 'dark';
    document.documentElement.className = `theme-${saved}`;
    return saved;
  });

  const changeTheme = (newTheme) => {
    document.documentElement.className = `theme-${newTheme}`;
    localStorage.setItem('chess-theme', newTheme);
    setTheme(newTheme);
  };

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
    username, setUsername, fullHistory, setFullHistory, loading, error,
    filters, setFilters, toggleMultiFilter, clearFilters,
    yearsAvailable, familiesAvailable, openingsAvailable,
    timeClassesAvailable, rulesAvailable, monthsAvailable, ratedAvailable,
    activeYears, activeTimeClasses, activeColors, activeResults, activeRules, activeMonths, activeRated,
    filteredData
  } = useChessData();

  const { stats } = filteredData;

  const handleExportPDF = async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    setPdfProgress(0);
    try {
      await generatePDF({ filters, stats, t, setProgress: setPdfProgress });
    } catch (e) {
      console.error('PDF export failed', e);
    } finally {
      setPdfLoading(false);
      setPdfProgress(0);
    }
  };

  const filterProps = {
    filters, setFilters, toggleMultiFilter, clearFilters,
    yearsAvailable, familiesAvailable, openingsAvailable,
    timeClassesAvailable, rulesAvailable, monthsAvailable, ratedAvailable,
    activeYears, activeTimeClasses, activeColors, activeResults, activeRules, activeMonths, activeRated
  };

  // ── Chart elements ───────────────────────────────────────────────────────
  const pieChart      = <ResultsPieChart data={stats.pie} winRate={stats.winRate} theme={theme} />;
  const openingsChart = <OpeningsBarChart data={stats.stackedOpenings} theme={theme} />;
  const eloChart      = <EloLineChart data={stats.elo} theme={theme} />;
  const accChart      = <AccuracyChart data={stats.accuracyBuckets} theme={theme} />;
  const colorChart    = <ColorPerformanceChart data={stats.colorStats} theme={theme} />;
  const monthlyChart  = <MonthlyTrendChart data={stats.monthlyTrend} theme={theme} />;
  const bubblesChart  = <OpeningBubblesChart data={stats.openingBubbles} theme={theme} />;
  const calendarChart = <CalendarChart data={stats.calendarData} theme={theme} />;

  // ── Desktop slides (width ≥ 1100): 2+1 grid per slide ───────────────────
  const desktopSlides = [
    {
      // Slide 1: Pie + Openings top row, ELO full bottom
      label: `${t('slides.results')} + ${t('slides.elo')}`,
      node: (
        <div className="slide-desktop-3">
          {pieChart}
          {openingsChart}
          {eloChart}
        </div>
      )
    },
    {
      // Slide 2: Accuracy + Color stacked left, Bubbles full right
      label: `${t('slides.accuracy')} + ${t('slides.bubbles')}`,
      node: (
        <div className="slide-2col-lr">
          <div className="slide-left-stack">
            {accChart}
            {colorChart}
          </div>
          {bubblesChart}
        </div>
      )
    },
    {
      // Slide 3: Calendar full top, Monthly full bottom
      label: `${t('slides.calendar')} + ${t('slides.monthly')}`,
      node: (
        <div className="slide-col-2">
          {calendarChart}
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
    { label: t('slides.calendar'), node: <div className="slide-col-2">{calendarChart}{monthlyChart}</div> }
  ];

  // ── Mobile landscape slides: 1 chart per slide ──────────────────────────
  const mobileSlides = [
    { label: t('slides.results'),          node: pieChart },
    { label: t('charts.openingSuccess'),   node: openingsChart },
    { label: t('slides.elo'),              node: eloChart },
    { label: t('slides.bubbles'),          node: bubblesChart },
    { label: t('slides.accuracy'),         node: accChart },
    { label: t('charts.colorPerformance'), node: colorChart },
    { label: t('slides.calendar'),         node: calendarChart },
    { label: t('slides.monthly'),          node: monthlyChart }
  ];

  const slides = isDesktop ? desktopSlides : isPortrait ? portraitSlides : mobileSlides;
  const layoutKey = isDesktop ? 'desktop' : isPortrait ? 'portrait' : 'mobile';
  const sliderKey = layoutKey;

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
        username={username}
        onUsernameSubmit={setUsername}
        mainTimeClass={stats.mainTimeClass}
        currentEloByMode={stats.currentEloByMode}
        maxEloByMode={stats.maxEloByMode}
        onExportPDF={handleExportPDF}
        pdfLoading={pdfLoading}
        pdfProgress={pdfProgress}
        fullHistory={fullHistory}
        onToggleHistory={setFullHistory}
        theme={theme}
        onThemeChange={changeTheme}
      />

      <FilterPanel {...filterProps} />

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
        <MobileFAB
          onFilterOpen={() => setFilterDrawerOpen(true)}
          onHistoryOpen={() => setHistoryDrawerOpen(true)}
        />
        {stats.mainTimeClass && (() => {
          const mc = stats.mainTimeClass;
          const col = ELO_COLORS[mc] || '#01B6FF';
          return (
            <div className="mobile-stats-strip">
              <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: col, fontWeight: 700 }}>
                {t(`timeClasses.${mc}`, mc)}
              </span>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                {t('header.currentElo')} <strong style={{ color: col }}>{stats.currentEloByMode?.[mc] ?? '—'}</strong>
              </span>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                {t('header.maxElo')} <strong style={{ color: col }}>{stats.maxEloByMode?.[mc] ?? '—'}</strong>
              </span>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: 'auto' }}>
                <strong style={{ color: '#E5E7E9' }}>{filteredData.games.length}</strong> {t('header.games').toLowerCase()}
              </span>
            </div>
          );
        })()}
        <ChartSlider key={sliderKey} slides={slides} />
      </main>

      <GameHistory games={filteredData.games} />

      <footer className="footer">ChessAnalytics © {new Date().getFullYear()} · {t('footer.disclaimer')}</footer>
    </div>
  );
}

export default App;
