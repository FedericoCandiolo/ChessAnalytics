import React from 'react';
import { useTranslation } from 'react-i18next';
import GameCard from './GameCard';

export default function GameHistory({ games, isDrawer = false, onClose }) {
  const { t } = useTranslation();

  const list = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem', flexShrink: 0 }}>
        <h3 style={{ margin: 0, fontSize: '0.9rem' }}>{t('gameHistory.title')}</h3>
        {isDrawer && onClose && (
          <button onClick={onClose} style={{ background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1 }}>×</button>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.375rem' }}>
        {games.slice().reverse().map((game) => (
          <GameCard key={game.url} game={game} />
        ))}
      </div>
    </>
  );

  if (isDrawer) return <>{list}</>;

  return (
    <aside className="right-col">
      {list}
    </aside>
  );
}
