import React, { useState, useEffect, useMemo } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  BarChart, Bar, LabelList
} from 'recharts';

const DETAILED_ECO = {
  "A00": "Irregular", "A04": "Reti", "A10": "Inglesa", "A40": "Peón Dama", "A45": "Trompowsky",
  "B00": "Peón Rey", "B01": "Escandinava", "B06": "Moderna", "B07": "Pirc", "B10": "Caro-Kann",
  "B20": "Siciliana", "C00": "Francesa", "C42": "Petrov", "C50": "Italiana", "C60": "Ruy López",
  "D00": "Gambito Dama", "D02": "Londres", "D10": "Eslava", "E11": "Bogo-India", "E60": "India Rey"
};

const ECO_FAMILIES = {
  "A": "Flanco", "B": "Semi-Abierta", "C": "Abierta", "D": "Cerradas", "E": "India"
};

const INITIAL_FILTERS = {
  timeClasses: [], 
  years: [],       
  color: 'all',
  result: 'all',
  family: 'all',
  opening: 'all'
};

const RITMOS = ["blitz", "rapid", "bullet"];

const ELO_COLORS = {
  blitz: '#f59e0b',
  rapid: '#10b981',
  bullet: '#ef4444'
};

const RESULT_COLORS = {
  win: '#00FF9C',
  draw: '#FFF301',
  loss: '#FF0101'
};

const StackedTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum, entry) => sum + entry.value, 0);
    return (
      <div style={{ background: '#0f172a', border: '1px solid #334155', padding: '10px', borderRadius: '8px', fontSize: '11px', zIndex: 100 }}>
        <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#fff' }}>{label}</p>
        {payload.slice().reverse().map((entry, index) => (
          <div key={index} style={{ color: entry.color, marginBottom: '2px' }}>
            {entry.name}: {entry.value} ({((entry.value / total) * 100).toFixed(1)}%)
          </div>
        ))}
        <div style={{ borderTop: '1px solid #334155', marginTop: '5px', paddingTop: '5px', color: '#94a3b8' }}>
          Total: {total} partidas
        </div>
      </div>
    );
  }
  return null;
};

function App() {
  const [username, setUsername] = useState('fedecandiolo');
  const [games, setGames] = useState([]);
  const [ecoDb, setEcoDb] = useState({});
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  // Variable de color para tarjetas (el gris de los selectores)
  const ITEM_BG = '#2d333f';

  useEffect(() => {
    fetch('https://unpkg.com/chess-openings-list@1.0.0/dist/openings.json')
      .then(res => res.json())
      .then(data => {
        const dict = {};
        data.forEach(item => { if(item.eco) dict[item.eco] = item.name; });
        setEcoDb(dict);
      }).catch(() => console.warn("ECO DB Offline"));
  }, []);

  useEffect(() => {
    if (!username) return;
    const fetchAllHistory = async () => {
      setLoading(true);
      setGames([]);
      try {
        const res = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`);
        const json = await res.json();
        const responses = await Promise.all(
          json.archives.map(url => fetch(url).then(r => r.ok ? r.json() : { games: [] }))
        );
        setGames(responses.flatMap(m => m.games || []));
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetchAllHistory();
  }, [username]);

  const processedAll = useMemo(() => {
    const DRAW_TYPES = ['agreed', 'repetition', 'stalemate', '50rule', 'insufficient', 'time_vs_insufficient'];
    return games.map(g => {
      const isWhite = g.white.username.toLowerCase() === username.toLowerCase();
      const myData = isWhite ? g.white : g.black;
      const dateObj = new Date(g.end_time * 1000);
      const ecoCode = g.pgn?.match(/\[ECO "(.*?)"\]/)?.[1] || "N/A";
      const famKey = ecoCode.charAt(0);
      const openingName = ecoDb[ecoCode] || DETAILED_ECO[ecoCode] || "Variante General";

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
        date: dateObj.toLocaleDateString('es-AR'),
        timestamp: g.end_time
      };
    }).sort((a, b) => a.timestamp - b.timestamp);
  }, [games, username, ecoDb]);

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

    data.forEach(g => {
      results[g.outcome]++;
      if (!opStats[g.openingFull]) opStats[g.openingFull] = { name: g.openingFull, victoria: 0, tablas: 0, derrota: 0, total: 0 };
      opStats[g.openingFull][g.outcome]++;
      opStats[g.openingFull].total++;

      if (!eloByDay[g.date]) eloByDay[g.date] = { name: g.date };
      eloByDay[g.date][g.time_class] = g.rating;
    });

    return {
      games: data,
      stats: {
        pie: [
          { name: 'Victorias', value: results.victoria, color: RESULT_COLORS.win },
          { name: 'Derrotas', value: results.derrota, color: RESULT_COLORS.loss },
          { name: 'Tablas', value: results.tablas, color: RESULT_COLORS.draw }
        ],
        elo: Object.values(eloByDay).slice(-150),
        stackedOpenings: Object.values(opStats).sort((a,b) => b.total - a.total).slice(0, 50),
        currentElo: data[data.length - 1]?.rating || '---'
      }
    };
  }, [processedAll, filters]);

  const toggleMultiFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter(i => i !== value) : [...prev[key], value]
    }));
  };

  return (
    <div className="grid-layout" style={{ 
      height: '100vh', overflow: 'hidden', display: 'grid', 
      gridTemplateColumns: '260px 1fr 320px', gridTemplateRows: '70px 1fr',
      '--color-item-bg': ITEM_BG // Definimos la variable CSS
    }}>
      
      {/* HEADER CON LOGO Y KPIs */}
      <header className="header" style={{ 
        gridColumn: '1 / -1', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '0 20px',
        background: '#161a23',
        borderBottom: '1px solid #2d333f'
      }}>
        {/* Bloque del Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img 
            src="/logo.png" // O el nombre exacto de tu archivo
            alt="ChessAnalytics Logo" 
            style={{ height: '45px', width: 'auto', borderRadius: '4px' }} 
          />
          
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className="kpi-box" style={{ textAlign: 'right' }}>
            <span style={{fontSize: '10px', opacity: 0.7, display: 'block'}}>ELO ACTUAL</span>
            <div style={{color: '#00FF9C', fontWeight: 'bold', fontSize: '18px'}}>{filteredData.stats.currentElo}</div>
          </div>
          <div className="kpi-box" style={{ textAlign: 'right' }}>
            <span style={{fontSize: '10px', opacity: 0.7, display: 'block'}}>PARTIDAS</span>
            <div style={{fontWeight: 'bold', fontSize: '18px', color: '#fff'}}>{filteredData.games.length}</div>
          </div>
          
          <div style={{ marginLeft: '20px', borderLeft: '1px solid #334155', paddingLeft: '20px' }}>
            <span title="Ingresa un username de Chess.com y presiona Enter" style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
              Analizar Jugador:
            </span>
            <input 
              className="search-input" 
              placeholder="FedeCandiolo" 
              onKeyDown={(e) => e.key === 'Enter' && setUsername(e.target.value.toLowerCase().trim())} 
              style={{
                border: '1px solid #334155',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: '4px',
                outline: 'none'
              }}
            />
          </div>
        </div>
      </header>

      {/* FILTROS (IZQUIERDA) */}
      <aside className="left-col" style={{ background: 'var(--color-card)', padding: '20px', borderRight: '1px solid #2d333f', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 className="subtitle" style={{margin:0}}>Filtros</h3>
          <button onClick={() => setFilters(INITIAL_FILTERS)} style={{ background:'transparent', color:'#60a5fa', border:'none', cursor:'pointer', fontSize:'11px' }}>Limpiar ↺</button>
        </div>
        
        <div className="filter-group">
          <label className="filter-label">Años</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {yearsAvailable.map(y => (
              <button key={y} onClick={() => toggleMultiFilter('years', y)} style={{ 
                padding: '4px 6px', borderRadius: '4px', border: '1px solid #334155', fontSize: '10px', cursor: 'pointer', 
                background: filters.years.includes(y) ? RESULT_COLORS.win : '#0f172a', 
                color: filters.years.includes(y) ? '#000' : 'white',
                fontWeight: filters.years.includes(y) ? 'bold' : 'normal'
              }}>{y}</button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <label className="filter-label">Ritmos</label>
          <div style={{ display: 'flex', gap: '4px' }}>
            {RITMOS.map(r => (
              <button key={r} onClick={() => toggleMultiFilter('timeClasses', r)} style={{ 
                flex: 1, padding: '4px', borderRadius: '4px', border: '1px solid #334155', fontSize: '9px', cursor: 'pointer', 
                background: filters.timeClasses.includes(r) ? RESULT_COLORS.win : '#0f172a', 
                color: filters.timeClasses.includes(r) ? '#000' : 'white',
                fontWeight: filters.timeClasses.includes(r) ? 'bold' : 'normal',
                textTransform: 'uppercase' 
              }}>{r}</button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <label className="filter-label">Piezas</label>
          <select className="filter-select" style={{background: 'var(--color-item-bg)'}} value={filters.color} onChange={e => setFilters({...filters, color: e.target.value})}>
            <option value="all">Ambas</option>
            <option value="white">Blancas</option>
            <option value="black">Negras</option>
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Familia ECO</label>
          <select className="filter-select" style={{background: 'var(--color-item-bg)'}} value={filters.family} onChange={e => setFilters({...filters, family: e.target.value, opening: 'all'})}>
            <option value="all">Todas</option>
            {familiesAvailable.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Resultado</label>
          <select className="filter-select" style={{background: 'var(--color-item-bg)'}} value={filters.result} onChange={e => setFilters({...filters, result: e.target.value})}>
            <option value="all">Todos</option>
            <option value="victoria">Victorias</option>
            <option value="derrota">Derrotas</option>
            <option value="tablas">Tablas</option>
          </select>
        </div>
      </aside>

      {/* CONTENIDO CENTRAL */}
      <main className="content" style={{ display: 'flex', flexDirection: 'column', padding: '0 20px', gap: '20px', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px', height: '50%', minHeight: '300px' }}>
          <div className="chart-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <h4 style={{margin:'0 0 10px 0', fontSize:'14px'}}>Distribución de Resultados</h4>
            <div style={{flex: 1}}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={filteredData.stats.pie} dataKey="value" innerRadius="60%" outerRadius="80%" paddingAngle={5}>
                    {filteredData.stats.pie.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                  </Pie>
                  <Tooltip contentStyle={{background: '#0f172a', border: '1px solid #334155', borderRadius: '8px'}} itemStyle={{color: '#fff', fontSize: '12px'}} />
                  <Legend wrapperStyle={{fontSize: '11px'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <h4 style={{margin:'0 0 10px 0', fontSize:'14px'}}>Éxito por Apertura</h4>
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
              <ResponsiveContainer width="100%" height={Math.max(250, filteredData.stats.stackedOpenings.length * 30)}>
                <BarChart data={filteredData.stats.stackedOpenings} layout="vertical" margin={{right: 40}}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={9} width={150} />
                  <Tooltip content={<StackedTooltip />} />
                  <Bar dataKey="victoria" stackId="a" fill={RESULT_COLORS.win} />
                  <Bar dataKey="tablas" stackId="a" fill={RESULT_COLORS.draw} />
                  <Bar dataKey="derrota" stackId="a" fill={RESULT_COLORS.loss} radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="total" position="right" fill="#fff" fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="chart-card" style={{ flex: 1, minHeight: '200px', display: 'flex', flexDirection: 'column' }}>
          <h4 style={{margin:'0 0 10px 0', fontSize:'14px'}}>Evolución de ELO (Últimos días)</h4>
          <div style={{ flex: 1, paddingBottom: '20px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredData.stats.elo}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" hide />
                <YAxis domain={['dataMin - 50', 'dataMax + 50']} stroke="#94a3b8" fontSize={10} />
                <Tooltip contentStyle={{background: '#0f172a', border: '1px solid #334155'}} />
                <Legend wrapperStyle={{ paddingTop: '15px' }} />
                
                <Line name="Rapid" type="monotone" dataKey="rapid" stroke={ELO_COLORS.rapid} strokeWidth={2} connectNulls 
                  dot={{ r: 4, fill: ELO_COLORS.rapid, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                <Line name="Blitz" type="monotone" dataKey="blitz" stroke={ELO_COLORS.blitz} strokeWidth={2} connectNulls 
                  dot={{ r: 4, fill: ELO_COLORS.blitz, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                <Line name="Bullet" type="monotone" dataKey="bullet" stroke={ELO_COLORS.bullet} strokeWidth={2} connectNulls 
                  dot={{ r: 4, fill: ELO_COLORS.bullet, strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>

      {/* HISTORIAL (DERECHA) */}
      <aside className="right-col" style={{ background: 'var(--color-card)', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #2d333f', overflow: 'hidden' }}>
        <h3 className="subtitle" style={{padding:'0 0 10px 0'}}>Partidas</h3>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 30px 20px 0' }}>
          {filteredData.games.slice().reverse().map((g, i) => (
            <div key={i} style={{ 
              background: 'var(--color-item-bg)', // Usando la variable de color
              borderRadius: '8px', padding: '12px', marginBottom: '10px', 
              borderLeft: `5px solid ${g.outcome === 'victoria' ? RESULT_COLORS.win : g.outcome === 'tablas' ? RESULT_COLORS.draw : RESULT_COLORS.loss}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', opacity: 0.6, marginBottom: '5px' }}>
                <span>{g.date} • {g.time_class.toUpperCase()}</span>
                <span>{g.playerIsWhite ? '⬜ B' : '⬛ N'}</span>
              </div>
              <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{g.rating} vs {g.opponent.name}</div>
              <div style={{ fontSize: '10px', color: '#60a5fa', margin: '4px 0' }}>{g.openingFull}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #334155', paddingTop: '8px', marginTop: '5px' }}>
                <span style={{ fontSize: '10px', opacity: 0.8 }}>{g.moves} mov. {g.accuracy ? `| 🎯${g.accuracy}%` : ''}</span>
                <a href={g.url} target="_blank" rel="noreferrer" style={{ color: RESULT_COLORS.win, textDecoration: 'none', fontSize: '10px', fontWeight: 'bold' }}>VER ↗</a>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

export default App;