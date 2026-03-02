import React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/i18n';
import { FileDown, Moon, Sun, Heart } from 'lucide-react';

const THEMES = [
  { key: 'dark',         icon: <Moon size={11} /> },
  { key: 'light',        icon: <Sun size={11} /> },
  { key: 'deuteranopia', icon: 'D' },
  { key: 'protanopia',   icon: 'P' },
  { key: 'tritanopia',   icon: 'T' },
];

function ThemeSwitcher({ theme, onThemeChange }) {
  const { t } = useTranslation();
  return (
    <div className="theme-switcher">
      {THEMES.map(th => (
        <button
          key={th.key}
          className={`theme-btn${theme === th.key ? ' active' : ''}`}
          onClick={() => onThemeChange(th.key)}
          title={t(`themes.${th.key}`, th.key)}
        >
          {th.icon}
        </button>
      ))}
    </div>
  );
}

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

export default function Header({ currentElo, gamesCount, username, onUsernameSubmit, mainTimeClass, currentEloByMode, maxEloByMode, onExportPDF, pdfLoading, pdfProgress, fullHistory, onToggleHistory, theme, onThemeChange }) {
  const { t } = useTranslation();
  const modeColor = mainTimeClass ? `var(--color-${mainTimeClass})` : 'var(--color-accent-blue)';
  const modeCurrentElo = mainTimeClass ? (currentEloByMode?.[mainTimeClass] ?? '---') : '---';
  const modeMaxElo = mainTimeClass ? (maxEloByMode?.[mainTimeClass] ?? '---') : '---';

  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <img
          src={`${process.env.PUBLIC_URL}/${theme === 'light' ? 'logo%20claro.png' : 'logo.png'}`}
          alt="ChessAnalytics Logo"
          style={{ height: '2.5rem', width: 'auto', borderRadius: '0.25rem' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {/* Main mode block */}
        {mainTimeClass && (
          <div className="kpi-box" style={{ textAlign: 'center', borderRight: `2px solid ${modeColor}`, paddingRight: '0.6rem' }}>
            <span style={{ fontSize: '0.55rem', opacity: 0.7, display: 'block', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {t(`timeClasses.${mainTimeClass}`, mainTimeClass)}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.5rem', color: 'var(--color-text-secondary)', display: 'block' }}>{t('header.currentElo')}</span>
                <span style={{ color: modeColor, fontWeight: 'bold', fontSize: '1rem' }}>{modeCurrentElo}</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.5rem', color: 'var(--color-text-secondary)', display: 'block' }}>{t('header.maxElo')}</span>
                <span style={{ color: modeColor, fontWeight: '600', fontSize: '0.85rem', opacity: 0.8 }}>{modeMaxElo}</span>
              </div>
            </div>
          </div>
        )}

        <div className="kpi-box" style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.55rem', opacity: 0.7, display: 'block', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{t('header.games')}</span>
          <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--color-text-primary)' }}>{gamesCount}</div>
        </div>

        <div style={{ borderLeft: '1px solid var(--color-border-subtle)', paddingLeft: '0.7rem' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.2rem' }}>
            {t('header.analyzePlayer')}:
          </span>
          <input className="search-input" placeholder={t('header.playerPlaceholder')}
            defaultValue={username}
            onKeyDown={(e) => e.key === 'Enter' && onUsernameSubmit(e.target.value.toLowerCase().trim())} />
          {/* History range toggle */}
          <div style={{ display: 'flex', gap: 0, marginTop: '0.25rem', background: 'var(--color-bg-dark)', borderRadius: '5px', padding: '2px' }}>
            <button
              onClick={() => onToggleHistory(false)}
              style={{
                flex: 1, padding: '2px 6px', borderRadius: '3px', border: 'none', cursor: 'pointer',
                fontSize: '9px', fontWeight: '700', letterSpacing: '0.04em', transition: 'all 0.15s',
                background: !fullHistory ? 'var(--color-item-bg)' : 'transparent',
                color: !fullHistory ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              }}
            >{t('header.recent')}</button>
            <button
              onClick={() => onToggleHistory(true)}
              style={{
                flex: 1, padding: '2px 6px', borderRadius: '3px', border: 'none', cursor: 'pointer',
                fontSize: '9px', fontWeight: '700', letterSpacing: '0.04em', transition: 'all 0.15s',
                background: fullHistory ? 'var(--color-item-bg)' : 'transparent',
                color: fullHistory ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              }}
            >{t('header.fullHistory')}</button>
          </div>
        </div>

        <ThemeSwitcher theme={theme} onThemeChange={onThemeChange} />
        <LangSwitcher />

        {/* Patreon link */}
        <a
          href="https://www.patreon.com/cw/ChessAnalytics"
          target="_blank"
          rel="noreferrer"
          className="patreon-btn"
          title="Support on Patreon"
        >
          <Heart size={12} fill="currentColor" />
          <span className="patreon-label">Patreon</span>
        </a>

        {/* PDF Export button */}
        <button
          className="pdf-export-btn"
          onClick={onExportPDF}
          disabled={pdfLoading}
          title={pdfLoading ? t('header.generatingPdf') : t('header.exportPdf')}
        >
          {pdfLoading ? (
            <span className="pdf-export-progress">
              {pdfProgress > 0 ? `${pdfProgress}%` : '…'}
            </span>
          ) : (
            <FileDown size={15} />
          )}
        </button>
      </div>
    </header>
  );
}
