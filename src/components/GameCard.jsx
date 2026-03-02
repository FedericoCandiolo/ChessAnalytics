import React from 'react';
import { useTranslation } from 'react-i18next';
export default function GameCard({ game }) {
  const { t, i18n } = useTranslation();
  const dateStr = new Date(game.timestamp * 1000).toLocaleDateString(
    i18n.language === 'en' ? 'en-US' : 'es-AR'
  );

  const borderColor = game.outcome === 'victoria'
    ? 'var(--color-win)'
    : game.outcome === 'tablas'
      ? 'var(--color-draw)'
      : 'var(--color-loss)';

  return (
    <div style={{
      background: 'var(--color-item-bg)',
      borderRadius: '0.5rem',
      padding: '0.75rem',
      marginBottom: '0.625rem',
      borderLeft: `0.3rem solid ${borderColor}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', opacity: 0.6, marginBottom: '0.3rem' }}>
        <span>{dateStr} • {game.time_class.toUpperCase()}</span>
        <span>{game.playerIsWhite ? `⬜ ${t('filters.white')[0]}` : `⬛ ${t('filters.black')[0]}`}</span>
      </div>
      <div style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>{game.rating} vs {game.opponent.name}</div>
      <div style={{ fontSize: '0.65rem', color: 'var(--color-accent-blue)', margin: '0.25rem 0 0.1rem' }}>{game.openingFull}</div>
      {game.openingLine && (
        <div style={{ fontSize: '0.58rem', color: '#4a7fa8', marginBottom: '0.25rem', fontStyle: 'italic' }}>{game.openingLine}</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.5rem', marginTop: '0.3rem' }}>
        <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>
          {t('gameHistory.opp')}: {game.opponent.rating ?? '?'}{game.accuracy ? ` | 🎯${game.accuracy}%` : ''}
        </span>
        <a href={game.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-win)', textDecoration: 'none', fontSize: '0.65rem', fontWeight: 'bold' }}>
          {t('gameHistory.view')}
        </a>
      </div>
    </div>
  );
}
