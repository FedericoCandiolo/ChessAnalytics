// Bilingual ECO fallback — used when an opening isn't in the main chess-openings-list DB
export const DETAILED_ECO = {
  en: {
    "A00": "Irregular Opening", "A04": "Reti Opening", "A10": "English Opening",
    "A40": "Queen's Pawn", "A45": "Trompowsky Attack",
    "B00": "King's Pawn", "B01": "Scandinavian Defense", "B06": "Modern Defense",
    "B07": "Pirc Defense", "B10": "Caro-Kann Defense",
    "B20": "Sicilian Defense", "C00": "French Defense", "C42": "Petrov Defense",
    "C50": "Italian Game", "C60": "Ruy López",
    "D00": "Queen's Gambit", "D02": "London System", "D10": "Slav Defense",
    "E11": "Bogo-Indian Defense", "E60": "King's Indian Defense"
  },
  es: {
    "A00": "Irregular", "A04": "Reti", "A10": "Inglesa", "A40": "Peón Dama",
    "A45": "Trompowsky", "B00": "Peón Rey", "B01": "Escandinava",
    "B06": "Moderna", "B07": "Pirc", "B10": "Caro-Kann",
    "B20": "Siciliana", "C00": "Francesa", "C42": "Petrov",
    "C50": "Italiana", "C60": "Ruy López",
    "D00": "Gambito Dama", "D02": "Londres", "D10": "Eslava",
    "E11": "Bogo-India", "E60": "India Rey"
  }
};

export const ECO_FAMILIES = {
  "A": "Flanco", "B": "Semi-Abierta", "C": "Abierta", "D": "Cerradas", "E": "India"
};

export const INITIAL_FILTERS = {
  rules: [],
  timeClasses: [],
  rated: [],           // multi-select: 1 (rated) or 0 (unrated)
  results: [],         // multi-select: 'victoria', 'tablas', 'derrota'
  colors: [],          // multi-select: 'white', 'black'
  family: 'all',
  opening: 'all',
  years: [],
  months: [],
  dateFrom: '',
  dateTo: ''
};

export const RITMOS = ["bullet", "blitz", "rapid", "daily"];

export const ELO_COLORS = {
  blitz:  '#f59e0b',
  rapid:  '#10b981',
  bullet: '#ef4444',
  daily:  '#a855f7'
};

export const RESULT_COLORS = {
  win:  '#00FF9C',
  draw: '#FFF301',
  loss: '#FF0101'
};

// Family colors for bubble chart
export const FAMILY_COLORS = {
  'Flanco':      '#60a5fa',
  'Semi-Abierta':'#f59e0b',
  'Abierta':     '#10b981',
  'Cerradas':    '#a855f7',
  'India':       '#ef4444',
  'Otros':       '#94a3b8'
};
