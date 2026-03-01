import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ECO_DB, ECO_FAMILIES, INITIAL_FILTERS, RESULT_COLORS } from '../constants';

const DRAW_TYPES = ['agreed', 'repetition', 'stalemate', '50rule', 'insufficient', 'time_vs_insufficient'];

function parseTimeControl(tc) {
  if (!tc || tc === '-' || tc.includes('/')) return null;
  const m = tc.match(/^(\d+)/);
  return m ? parseInt(m[1]) : null;
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function quantile(arr, q) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const pos = q * (s.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export function useChessData() {
  const { t, i18n } = useTranslation();
  const [username, setUsername] = useState('faustinooro');
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
    const fallbackName = t('charts.generalVariation');

    return games.map(g => {
      const isWhite = g.white.username.toLowerCase() === username.toLowerCase();
      const myData = isWhite ? g.white : g.black;
      const dateObj = new Date(g.end_time * 1000);
      const isoDate = dateObj.toISOString().slice(0, 10);
      const ecoCode = g.pgn?.match(/\[ECO "(.*?)"\]/)?.[1] || "N/A";
      const famKey = ecoCode.charAt(0);
      const openingName = ECO_DB[ecoCode] || ecoDb[ecoCode] || fallbackName;
      const ecoUrlRaw = g.pgn?.match(/\[ECOUrl "(https:\/\/www\.chess\.com\/openings\/([^"]+))"\]/)?.[2] || null;
      const openingLine = ecoUrlRaw ? ecoUrlRaw.replace(/-/g, ' ') : null;
      const dayOfWeek = dateObj.getDay(); // 0=Sun
      const lang = i18n.language || 'en';
      const dateLocale = lang === 'en' ? 'en-US' : 'es-AR';

      return {
        ...g,
        playerIsWhite: isWhite,
        rating: myData.rating,
        rated: g.rated ? 1 : 0,
        time_class: g.time_class,
        rules: g.rules || 'chess',
        initialTime: parseTimeControl(g.time_control),
        accuracy: g.accuracies ? Math.round(isWhite ? g.accuracies.white : g.accuracies.black) : null,
        opponent: { name: (isWhite ? g.black : g.white).username, rating: (isWhite ? g.black : g.white).rating },
        year: dateObj.getFullYear().toString(),
        month: isoDate.slice(0, 7),
        monthNum: dateObj.getMonth() + 1,
        weekday: (dayOfWeek + 6) % 7, // Mon=0..Sun=6
        isoDate,
        dateObj,
        family: ECO_FAMILIES[famKey] || "Otros",
        openingFull: `${ecoCode} – ${openingName}`,
        openingLine,
        outcome: myData.result === 'win' ? 'victoria' : (DRAW_TYPES.includes(myData.result) ? 'tablas' : 'derrota'),
        termination: myData.result,
        date: dateObj.toLocaleDateString(dateLocale),
        timestamp: g.end_time
      };
    }).sort((a, b) => a.timestamp - b.timestamp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games, username, ecoDb, i18n.language]);

  // ── Static available options (from all games) ───────────────────────────
  const yearsAvailable = useMemo(() => [...new Set(processedAll.map(g => g.year))].sort().reverse(), [processedAll]);
  const familiesAvailable = useMemo(() => [...new Set(processedAll.map(g => g.family))].sort(), [processedAll]);
  const timeClassesAvailable = useMemo(() => [...new Set(processedAll.map(g => g.time_class))].sort(), [processedAll]);
  const rulesAvailable = useMemo(() => [...new Set(processedAll.map(g => g.rules).filter(Boolean))].sort(), [processedAll]);
  const monthsAvailable = useMemo(() => [...new Set(processedAll.map(g => g.monthNum).filter(Boolean))].sort((a, b) => a - b), [processedAll]);
  const ratedAvailable = useMemo(() => [...new Set(processedAll.map(g => g.rated))].sort().reverse(), [processedAll]);

  // Openings available filtered by current family selection
  const openingsAvailable = useMemo(() => {
    const source = filters.family === 'all' ? processedAll : processedAll.filter(g => g.family === filters.family);
    return [...new Set(source.map(g => g.openingFull))].sort();
  }, [processedAll, filters.family]);

  // ── Active options (for disabled chip visual) ───────────────────────────
  // For each filter key, compute which values are "live" given all OTHER filters
  const makeActiveSet = (excludeKey, valueGetter) => {
    const other = processedAll.filter(g => {
      if (excludeKey !== 'years'       && filters.years.length > 0       && !filters.years.includes(g.year)) return false;
      if (excludeKey !== 'timeClasses' && filters.timeClasses.length > 0 && !filters.timeClasses.includes(g.time_class)) return false;
      if (excludeKey !== 'colors'      && filters.colors.length > 0      && !filters.colors.some(c => c === 'white' ? g.playerIsWhite : !g.playerIsWhite)) return false;
      if (excludeKey !== 'results'     && filters.results.length > 0     && !filters.results.includes(g.outcome)) return false;
      if (excludeKey !== 'rules'       && filters.rules.length > 0       && !filters.rules.includes(g.rules)) return false;
      if (excludeKey !== 'months'      && filters.months.length > 0      && !filters.months.includes(g.monthNum)) return false;
      if (excludeKey !== 'rated'       && filters.rated.length > 0       && !filters.rated.includes(g.rated)) return false;
      if (filters.family !== 'all'     && g.family !== filters.family) return false;
      if (filters.opening !== 'all'    && g.openingFull !== filters.opening) return false;
      if (filters.dateFrom) { const [fy,fm,fd] = filters.dateFrom.split('-').map(Number); if (g.timestamp*1000 < new Date(fy,fm-1,fd).getTime()) return false; }
      if (filters.dateTo)   { const [ty,tm,td] = filters.dateTo.split('-').map(Number);   if (g.timestamp*1000 >= new Date(ty,tm-1,td+1).getTime()) return false; }
      return true;
    });
    return new Set(other.map(valueGetter));
  };

  const activeYears       = useMemo(() => makeActiveSet('years',       g => g.year),                                  // eslint-disable-next-line react-hooks/exhaustive-deps
    [processedAll, filters]);
  const activeTimeClasses = useMemo(() => makeActiveSet('timeClasses', g => g.time_class),                            // eslint-disable-next-line react-hooks/exhaustive-deps
    [processedAll, filters]);
  const activeColors      = useMemo(() => makeActiveSet('colors',      g => g.playerIsWhite ? 'white' : 'black'),     // eslint-disable-next-line react-hooks/exhaustive-deps
    [processedAll, filters]);
  const activeResults     = useMemo(() => makeActiveSet('results',     g => g.outcome),                               // eslint-disable-next-line react-hooks/exhaustive-deps
    [processedAll, filters]);
  const activeRules       = useMemo(() => makeActiveSet('rules',       g => g.rules),                                 // eslint-disable-next-line react-hooks/exhaustive-deps
    [processedAll, filters]);
  const activeMonths      = useMemo(() => makeActiveSet('months',      g => g.monthNum),                              // eslint-disable-next-line react-hooks/exhaustive-deps
    [processedAll, filters]);
  const activeRated       = useMemo(() => makeActiveSet('rated',       g => g.rated),                                 // eslint-disable-next-line react-hooks/exhaustive-deps
    [processedAll, filters]);

  // ── Filtered data + derived stats ──────────────────────────────────────
  const filteredData = useMemo(() => {
    const data = processedAll.filter(g => {
      if (filters.years.length > 0       && !filters.years.includes(g.year)) return false;
      if (filters.timeClasses.length > 0 && !filters.timeClasses.includes(g.time_class)) return false;
      if (filters.colors.length > 0      && !filters.colors.some(c => c === 'white' ? g.playerIsWhite : !g.playerIsWhite)) return false;
      if (filters.results.length > 0     && !filters.results.includes(g.outcome)) return false;
      if (filters.family !== 'all'       && g.family !== filters.family) return false;
      if (filters.opening !== 'all'      && g.openingFull !== filters.opening) return false;
      if (filters.rules.length > 0       && !filters.rules.includes(g.rules)) return false;
      if (filters.months.length > 0      && !filters.months.includes(g.monthNum)) return false;
      if (filters.rated.length > 0       && !filters.rated.includes(g.rated)) return false;
      if (filters.dateFrom) { const [fy,fm,fd] = filters.dateFrom.split('-').map(Number); if (g.timestamp*1000 < new Date(fy,fm-1,fd).getTime()) return false; }
      if (filters.dateTo)   { const [ty,tm,td] = filters.dateTo.split('-').map(Number);   if (g.timestamp*1000 >= new Date(ty,tm-1,td+1).getTime()) return false; }
      return true;
    });

    const results  = { victoria: 0, derrota: 0, tablas: 0 };
    const opStats  = {};
    const eloByDay = {};
    const accBuckets = { '<50': 0, '50-59': 0, '60-69': 0, '70-79': 0, '80-89': 0, '90+': 0 };
    const colorStats = [
      { name: 'white', victoria: 0, tablas: 0, derrota: 0 },
      { name: 'black', victoria: 0, tablas: 0, derrota: 0 }
    ];
    const monthMap = {};
    const timeClassCounts = {};
    const eloByMode = {};
    const calendarMap = {};
    const weekdayNetScores = Array.from({ length: 7 }, () => []);

    data.forEach(g => {
      results[g.outcome]++;

      // Openings
      if (!opStats[g.openingFull]) opStats[g.openingFull] = { name: g.openingFull, family: g.family, victoria: 0, tablas: 0, derrota: 0, total: 0 };
      opStats[g.openingFull][g.outcome]++;
      opStats[g.openingFull].total++;

      // ELO by day — track array per TC for min/max/final band
      if (!eloByDay[g.isoDate]) eloByDay[g.isoDate] = { name: g.date, isoDate: g.isoDate, dateObj: g.dateObj };
      const tcKey = `_${g.time_class}`;
      if (!eloByDay[g.isoDate][tcKey]) eloByDay[g.isoDate][tcKey] = [];
      eloByDay[g.isoDate][tcKey].push(g.rating);

      // Accuracy buckets
      if (g.accuracy !== null) {
        if (g.accuracy < 50) accBuckets['<50']++;
        else if (g.accuracy < 60) accBuckets['50-59']++;
        else if (g.accuracy < 70) accBuckets['60-69']++;
        else if (g.accuracy < 80) accBuckets['70-79']++;
        else if (g.accuracy < 90) accBuckets['80-89']++;
        else accBuckets['90+']++;
      }

      colorStats[g.playerIsWhite ? 0 : 1][g.outcome]++;

      // Monthly
      const monthKey = g.month;
      if (!monthMap[monthKey]) monthMap[monthKey] = { month: monthKey, victoria: 0, derrota: 0, tablas: 0, total: 0 };
      monthMap[monthKey][g.outcome]++;
      monthMap[monthKey].total++;
      if (g.time_class) monthMap[monthKey][g.time_class] = (monthMap[monthKey][g.time_class] || 0) + 1;

      // Time class counts
      timeClassCounts[g.time_class] = (timeClassCounts[g.time_class] || 0) + 1;
      if (!eloByMode[g.time_class]) eloByMode[g.time_class] = [];
      eloByMode[g.time_class].push(g.rating);

      // Calendar
      if (!calendarMap[g.isoDate]) calendarMap[g.isoDate] = { date: g.isoDate, wins: 0, losses: 0, draws: 0 };
      if (g.outcome === 'victoria')  calendarMap[g.isoDate].wins++;
      else if (g.outcome === 'derrota') calendarMap[g.isoDate].losses++;
      else calendarMap[g.isoDate].draws++;

      // Weekday net scores (Mon=0..Sun=6)
      const netVal = g.outcome === 'victoria' ? 1 : g.outcome === 'derrota' ? -1 : 0;
      weekdayNetScores[g.weekday].push(netVal);
    });

    // Resolve ELO day bands
    const TIME_CLASSES = ['rapid', 'blitz', 'bullet', 'daily'];
    Object.values(eloByDay).forEach(day => {
      TIME_CLASSES.forEach(tc => {
        const arr = day[`_${tc}`];
        if (arr && arr.length > 0) {
          day[tc]          = arr[arr.length - 1];
          day[`${tc}_min`] = Math.min(...arr);
          day[`${tc}_max`] = Math.max(...arr);
        }
        delete day[`_${tc}`];
      });
    });

    const total   = data.length;
    const winRate = total > 0 ? Math.round((results.victoria / total) * 100) : 0;

    const locale = i18n.language === 'en' ? 'en-US' : 'es-AR';
    const monthlyTrend = Object.values(monthMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => {
        const [yr, mo] = m.month.split('-').map(Number);
        return {
          ...m,
          label: new Date(yr, mo - 1, 1).toLocaleDateString(locale, { month: 'short', year: '2-digit' }),
          winRate: m.total > 0 ? Math.round((m.victoria / m.total) * 100) : 0,
          bullet: m.bullet || 0,
          blitz:  m.blitz  || 0,
          rapid:  m.rapid  || 0,
          daily:  m.daily  || 0,
        };
      });

    // Accuracy vs ELO scatter
    const accuracyVsElo = data
      .filter(g => g.accuracy !== null && g.accuracy > 0)
      .map(g => ({
        elo: g.rating,
        accuracy: g.accuracy,
        result: g.outcome,
        color: g.playerIsWhite ? 'white' : 'black',
        opponent: g.opponent?.name || '',
        opponentRating: g.opponent?.rating || 0
      }));

    // Opening bubbles (family + net score)
    const openingBubbles = Object.values(opStats).map(op => ({
      ...op,
      netScore: op.victoria - op.derrota
    }));

    // Calendar data
    const calendarData = Object.values(calendarMap).map(d => ({
      ...d,
      net: d.wins - d.losses
    }));

    // Weekday radial data — IQR + range per weekday
    const weekdayData = weekdayNetScores.map((scores, wd) => ({
      weekday: wd,
      count: scores.length,
      median: scores.length ? median(scores) : 0,
      q1:     scores.length ? quantile(scores, 0.25) : 0,
      q3:     scores.length ? quantile(scores, 0.75) : 0,
      min:    scores.length ? Math.min(...scores) : 0,
      max:    scores.length ? Math.max(...scores) : 0
    }));

    // Main time class and ELO by mode
    const mainTimeClass = Object.entries(timeClassCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const currentEloByMode = {};
    const maxEloByMode = {};
    Object.entries(eloByMode).forEach(([mode, ratings]) => {
      currentEloByMode[mode] = ratings[ratings.length - 1];
      maxEloByMode[mode] = Math.max(...ratings);
    });

    return {
      games: data,
      stats: {
        pie: [
          { name: 'Victorias', value: results.victoria, color: RESULT_COLORS.win },
          { name: 'Derrotas',  value: results.derrota,  color: RESULT_COLORS.loss },
          { name: 'Tablas',    value: results.tablas,   color: RESULT_COLORS.draw }
        ],
        elo: Object.values(eloByDay).slice(-150),
        stackedOpenings: Object.values(opStats).sort((a, b) => b.total - a.total).slice(0, 50),
        currentElo: data[data.length - 1]?.rating || '---',
        winRate,
        accuracyBuckets: Object.entries(accBuckets).map(([bucket, count]) => ({ bucket, count })),
        colorStats,
        monthlyTrend,
        accuracyVsElo,
        openingBubbles,
        calendarData,
        weekdayData,
        mainTimeClass,
        currentEloByMode,
        maxEloByMode
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
    openingsAvailable,
    timeClassesAvailable,
    rulesAvailable,
    monthsAvailable,
    ratedAvailable,
    activeYears,
    activeTimeClasses,
    activeColors,
    activeResults,
    activeRules,
    activeMonths,
    activeRated,
    filteredData
  };
}
