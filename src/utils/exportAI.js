const WEEKDAY_EN = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function buildStats(username, stats, gamesCount) {
  const wins   = stats.pie.find(p => p.name === 'Victorias')?.value ?? 0;
  const losses = stats.pie.find(p => p.name === 'Derrotas')?.value  ?? 0;
  const draws  = stats.pie.find(p => p.name === 'Tablas')?.value    ?? 0;

  return {
    username,
    summary: {
      totalGames:            gamesCount,
      wins,
      losses,
      draws,
      winRate:               stats.winRate,
      mainTimeClass:         stats.mainTimeClass,
      currentEloByTimeClass: stats.currentEloByMode,
      peakEloByTimeClass:    stats.maxEloByMode,
    },
    performanceByColor: stats.colorStats.map(c => ({
      color:   c.name,
      wins:    c.victoria,
      draws:   c.tablas,
      losses:  c.derrota,
      total:   c.victoria + c.tablas + c.derrota,
      winRate: (c.victoria + c.tablas + c.derrota) > 0
        ? Math.round((c.victoria / (c.victoria + c.tablas + c.derrota)) * 100)
        : 0,
    })),
    accuracyDistribution: stats.accuracyBuckets,
    // Top 20 openings by games played
    topOpenings: [...stats.openingBubbles]
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)
      .map(o => ({
        name:     o.name,
        family:   o.family,
        games:    o.total,
        wins:     o.victoria,
        draws:    o.tablas,
        losses:   o.derrota,
        netScore: o.netScore,
        winRate:  o.total > 0 ? Math.round((o.victoria / o.total) * 100) : 0,
      })),
    // Last 12 months of trend data
    monthlyTrend: stats.monthlyTrend.slice(-12).map(m => ({
      month:   m.month,
      games:   m.total,
      wins:    m.victoria,
      draws:   m.tablas,
      losses:  m.derrota,
      winRate: m.winRate,
    })),
    // medianNetScore: 1 = all wins, -1 = all losses, 0 = balanced
    weekdayPerformance: stats.weekdayData.map(w => ({
      day:           WEEKDAY_EN[w.weekday],
      gamesPlayed:   w.count,
      medianNetScore: w.median,
    })),
  };
}

export function buildAIExport(username, filteredData, lang) {
  const { stats, games } = filteredData;
  const json = JSON.stringify(buildStats(username, stats, games.length), null, 2);

  if (lang === 'es') {
    return (
      `Analiza las siguientes estadísticas de rendimiento en Chess.com para el jugador "${username}".\n` +
      `Basándote en estos datos, por favor:\n` +
      `1. Resume el rendimiento general (nivel de ELO, porcentaje de victorias, ritmo principal).\n` +
      `2. Identifica las 3 principales fortalezas (ej: mejores aperturas, color de piezas, mejores días de la semana).\n` +
      `3. Identifica las 3 principales debilidades (ej: peores aperturas, distribución de precisión, peores días).\n` +
      `4. Proporciona 3–5 recomendaciones específicas y accionables para mejorar los resultados.\n` +
      `\nNota: "medianNetScore" va de -1 (todas derrotas) a +1 (todas victorias). "netScore" en aperturas = victorias menos derrotas.\n` +
      `\nDATOS:\n${json}`
    );
  }

  return (
    `Analyze the following Chess.com performance statistics for player "${username}".\n` +
    `Based on this data, please:\n` +
    `1. Summarize overall performance (ELO level, win rate, primary time control).\n` +
    `2. Identify the top 3 strengths (e.g. best openings, piece color, best weekdays).\n` +
    `3. Identify the top 3 weaknesses (e.g. worst openings, accuracy gaps, worst weekdays).\n` +
    `4. Provide 3–5 specific, actionable recommendations to improve results.\n` +
    `\nNote: "medianNetScore" ranges from -1 (all losses) to +1 (all wins). Opening "netScore" = wins minus losses.\n` +
    `\nDATA:\n${json}`
  );
}
