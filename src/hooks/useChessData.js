import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DETAILED_ECO, ECO_FAMILIES, INITIAL_FILTERS, RESULT_COLORS } from '../constants';

const DRAW_TYPES = ['agreed', 'repetition', 'stalemate', '50rule', 'insufficient', 'time_vs_insufficient'];

export function useChessData() {
  const { t, i18n } = useTranslation();
  const [username, setUsername] = useState('fedecandiolo');
  const [games, setGames] = useState([]);
  const [ecoDb, setEcoDb] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  useEffect(() => {
    fetch('https://unpkg.com/chess-openings-list@1.0.0/dist/openings.json')
      .then(res => res.json())
      .then(data => {
        const dict = {};
        data.forEach(item => { if (item.eco) dict[item.eco] = item.name; });
        setEcoDb(dict);
      }).catch(() => console.warn("ECO DB Offline"));
  }, []);

  useEffect(() => {
    if (!username) return;
    const fetchAllHistory = async () => {
      setLoading(true);
      setError(null);
      setGames([]);
      try {
        const res = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`);
        if (!res.ok) throw new Error(`User not found: ${username}`);
        const json = await res.json();
        if (!json.archives || json.archives.length === 0) throw new Error('No games found for this user.');
        const responses = await Promise.all(
          json.archives.map(url => fetch(url).then(r => r.ok ? r.json() : { games: [] }))
        );
        setGames(responses.flatMap(m => m.games || []));
      } catch (e) {
        setError(e.message);
      }
      setLoading(false);
    };
    fetchAllHistory();
  }, [username]);

  const processedAll = useMemo(() => {
    const lang = i18n.language || 'en';
    const localEco = DETAILED_ECO[lang] || DETAILED_ECO.en;
    const dateLocale = lang === 'en' ? 'en-US' : 'es-AR';
    const fallbackName = t('charts.generalVariation');

    return games.map(g => {
      const isWhite = g.white.username.toLowerCase() === username.toLowerCase();
      const myData = isWhite ? g.white : g.black;
      const dateObj = new Date(g.end_time * 1000);
      const ecoCode = g.pgn?.match(/\[ECO "(.*?)"\]/)?.[1] || "N/A";
      const famKey = ecoCode.charAt(0);

      // Priority: language-local fallback (translated), then ecoDb (English), then generic fallback
      const openingName = localEco[ecoCode] || ecoDb[ecoCode] || fallbackName;

      return {
        ...g,
        playerIsWhite: isWhite,
        rating: myData.rating,
        time_class: g.time_class,
        accuracy: g.accuracies ? Math.round(isWhite ? g.accuracies.white : g.accuracies.black) : null,
        opponent: { name: (isWhite ? g.black : g.white).username, rating: (isWhite ? g.black : g.white).rating },
        moves: g.pgn?.match(/(\d+)\./g)?.length || 0,
        year: dateObj.getFullYear().toString(),
        family: ECO_FAMILIES[famKey] || "Otros",
        openingFull: `${ecoCode} - ${openingName}`,
        outcome: myData.result === 'win' ? 'victoria' : (DRAW_TYPES.includes(myData.result) ? 'tablas' : 'derrota'),
        date: dateObj.toLocaleDateString(dateLocale),
        timestamp: g.end_time
      };
    }).sort((a, b) => a.timestamp - b.timestamp);
  // i18n.language triggers reprocessing when user switches language
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games, username, ecoDb, i18n.language]);

  const yearsAvailable = useMemo(() => [...new Set(processedAll.map(g => g.year))].sort().reverse(), [processedAll]);
  const familiesAvailable = useMemo(() => [...new Set(processedAll.map(g => g.family))].sort(), [processedAll]);

  const filteredData = useMemo(() => {
    const data = processedAll.filter(g => {
      if (filters.years.length > 0 && !filters.years.includes(g.year)) return false;
      if (filters.timeClasses.length > 0 && !filters.timeClasses.includes(g.time_class)) return false;
      if (filters.color !== 'all' && (filters.color === 'white' ? !g.playerIsWhite : g.playerIsWhite)) return false;
      if (filters.result !== 'all' && g.outcome !== filters.result) return false;
      if (filters.family !== 'all' && g.family !== filters.family) return false;
      if (filters.opening !== 'all' && g.openingFull !== filters.opening) return false;
      return true;
    });

    const results = { victoria: 0, derrota: 0, tablas: 0 };
    const opStats = {};
    const eloByDay = {};
    const accBuckets = { '<50': 0, '50-59': 0, '60-69': 0, '70-79': 0, '80-89': 0, '90+': 0 };
    const colorStats = [
      { name: 'white', victoria: 0, tablas: 0, derrota: 0 },
      { name: 'black', victoria: 0, tablas: 0, derrota: 0 }
    ];
    const monthMap = {};

    data.forEach(g => {
      results[g.outcome]++;

      if (!opStats[g.openingFull]) opStats[g.openingFull] = { name: g.openingFull, victoria: 0, tablas: 0, derrota: 0, total: 0 };
      opStats[g.openingFull][g.outcome]++;
      opStats[g.openingFull].total++;

      if (!eloByDay[g.date]) eloByDay[g.date] = { name: g.date };
      eloByDay[g.date][g.time_class] = g.rating;

      if (g.accuracy !== null) {
        if (g.accuracy < 50) accBuckets['<50']++;
        else if (g.accuracy < 60) accBuckets['50-59']++;
        else if (g.accuracy < 70) accBuckets['60-69']++;
        else if (g.accuracy < 80) accBuckets['70-79']++;
        else if (g.accuracy < 90) accBuckets['80-89']++;
        else accBuckets['90+']++;
      }

      colorStats[g.playerIsWhite ? 0 : 1][g.outcome]++;

      const monthKey = new Date(g.timestamp * 1000).toISOString().slice(0, 7);
      if (!monthMap[monthKey]) monthMap[monthKey] = { month: monthKey, victoria: 0, derrota: 0, tablas: 0, total: 0 };
      monthMap[monthKey][g.outcome]++;
      monthMap[monthKey].total++;
    });

    const total = data.length;
    const winRate = total > 0 ? Math.round((results.victoria / total) * 100) : 0;

    const locale = i18n.language === 'en' ? 'en-US' : 'es-AR';
    const monthlyTrend = Object.values(monthMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        ...m,
        label: new Date(m.month + '-01').toLocaleDateString(locale, { month: 'short', year: '2-digit' }),
        winRate: m.total > 0 ? Math.round((m.victoria / m.total) * 100) : 0
      }));

    return {
      games: data,
      stats: {
        pie: [
          { name: 'Victorias', value: results.victoria, color: RESULT_COLORS.win },
          { name: 'Derrotas', value: results.derrota, color: RESULT_COLORS.loss },
          { name: 'Tablas', value: results.tablas, color: RESULT_COLORS.draw }
        ],
        elo: Object.values(eloByDay).slice(-150),
        stackedOpenings: Object.values(opStats).sort((a, b) => b.total - a.total).slice(0, 50),
        currentElo: data[data.length - 1]?.rating || '---',
        winRate,
        accuracyBuckets: Object.entries(accBuckets).map(([bucket, count]) => ({ bucket, count })),
        colorStats,
        monthlyTrend
      }
    };
  }, [processedAll, filters, i18n.language]);

  const toggleMultiFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter(i => i !== value) : [...prev[key], value]
    }));
  };

  const clearFilters = () => setFilters(INITIAL_FILTERS);

  return {
    username,
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
  };
}
