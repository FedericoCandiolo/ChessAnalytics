import React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/i18n';

function LangSwitcher() {
  const lang = i18n.language;
  const set = (l) => { i18n.changeLanguage(l); localStorage.setItem('lang', l); };
  return (
    <div className="lang-switcher">
      <button className={`lang-btn${lang === 'es' ? ' active' : ''}`} onClick={() => set('es')}>ES</button>
      <button className={`lang-btn${lang === 'en' ? ' active' : ''}`} onClick={() => set('en')}>EN</button>
    </div>
  );
}

export default function Header({ currentElo, gamesCount, onUsernameSubmit }) {
  const { t } = useTranslation();

  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <img
          src="/logo.png"
          alt="ChessAnalytics Logo"
          style={{ height: '2.8rem', width: 'auto', borderRadius: '0.25rem' }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div className="kpi-box" style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.625rem', opacity: 0.7, display: 'block', letterSpacing: '0.05em' }}>{t('header.currentElo')}</span>
          <div style={{ color: '#00FF9C', fontWeight: 'bold', fontSize: '1.125rem' }}>{currentElo}</div>
        </div>

        <div className="kpi-box" style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.625rem', opacity: 0.7, display: 'block', letterSpacing: '0.05em' }}>{t('header.games')}</span>
          <div style={{ fontWeight: 'bold', fontSize: '1.125rem', color: '#fff' }}>{gamesCount}</div>
        </div>

        <div style={{ borderLeft: '1px solid #334155', paddingLeft: '0.75rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>
            {t('header.analyzePlayer')}:
          </span>
          <input
            className="search-input"
            placeholder={t('header.playerPlaceholder')}
            onKeyDown={(e) => e.key === 'Enter' && onUsernameSubmit(e.target.value.toLowerCase().trim())}
          />
        </div>

        <LangSwitcher />
      </div>
    </header>
  );
}
