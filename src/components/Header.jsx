import React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/i18n';
import { ELO_COLORS } from '../constants';
import { FileDown } from 'lucide-react';

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

export default function Header({ currentElo, gamesCount, onUsernameSubmit, mainTimeClass, currentEloByMode, maxEloByMode, onExportPDF, pdfLoading, pdfProgress, fullHistory, onToggleHistory }) {
  const { t } = useTranslation();
  const modeColor = ELO_COLORS[mainTimeClass] || '#01B6FF';
  const modeCurrentElo = mainTimeClass ? (currentEloByMode?.[mainTimeClass] ?? '---') : '---';
  const modeMaxElo = mainTimeClass ? (maxEloByMode?.[mainTimeClass] ?? '---') : '---';

  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <img src="/logo.png" alt="ChessAnalytics Logo"
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
                <span style={{ fontSize: '0.5rem', color: '#94a3b8', display: 'block' }}>{t('header.currentElo')}</span>
                <span style={{ color: modeColor, fontWeight: 'bold', fontSize: '1rem' }}>{modeCurrentElo}</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.5rem', color: '#94a3b8', display: 'block' }}>{t('header.maxElo')}</span>
                <span style={{ color: modeColor, fontWeight: '600', fontSize: '0.85rem', opacity: 0.8 }}>{modeMaxElo}</span>
              </div>
            </div>
          </div>
        )}

        <div className="kpi-box" style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.55rem', opacity: 0.7, display: 'block', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{t('header.games')}</span>
          <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#fff' }}>{gamesCount}</div>
        </div>

        <div style={{ borderLeft: '1px solid #334155', paddingLeft: '0.7rem' }}>
          <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>
            {t('header.analyzePlayer')}:
          </span>
          <input className="search-input" placeholder={t('header.playerPlaceholder')}
            onKeyDown={(e) => e.key === 'Enter' && onUsernameSubmit(e.target.value.toLowerCase().trim())} />
          {/* History range toggle */}
          <div style={{ display: 'flex', gap: 0, marginTop: '0.25rem', background: '#0f172a', borderRadius: '5px', padding: '2px' }}>
            <button
              onClick={() => onToggleHistory(false)}
              style={{
                flex: 1, padding: '2px 6px', borderRadius: '3px', border: 'none', cursor: 'pointer',
                fontSize: '9px', fontWeight: '700', letterSpacing: '0.04em', transition: 'all 0.15s',
                background: !fullHistory ? '#334155' : 'transparent',
                color: !fullHistory ? '#e2e8f0' : '#475569',
              }}
            >{t('header.recent')}</button>
            <button
              onClick={() => onToggleHistory(true)}
              style={{
                flex: 1, padding: '2px 6px', borderRadius: '3px', border: 'none', cursor: 'pointer',
                fontSize: '9px', fontWeight: '700', letterSpacing: '0.04em', transition: 'all 0.15s',
                background: fullHistory ? '#334155' : 'transparent',
                color: fullHistory ? '#e2e8f0' : '#475569',
              }}
            >{t('header.fullHistory')}</button>
          </div>
        </div>

        <LangSwitcher />

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
