import React from 'react';
import { useTranslation } from 'react-i18next';
import { RESULT_COLORS, FAMILY_LETTER, getOpeningDisplay } from '../constants';

const ITEM_BG = '#2d333f';

const MONTH_ABBR = {
  es: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
  en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
};

// Multi-select chip component with "available" dimming support
function MultiChip({ items, active, onToggle, labelFn, available }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
      {items.map(v => {
        const on = active.includes(v);
        const avail = !available || available.has(v);
        return (
          <button
            key={v}
            onClick={() => avail || on ? onToggle(v) : undefined}
            title={!avail ? '—' : undefined}
            style={{
              padding: '3px 7px', borderRadius: '4px',
              border: `1px solid ${on ? RESULT_COLORS.win : avail ? '#334155' : '#1e2533'}`,
              fontSize: '10px', cursor: avail || on ? 'pointer' : 'default',
              background: on ? RESULT_COLORS.win : avail ? '#0f172a' : '#0a0d14',
              color: on ? '#000' : avail ? 'white' : '#3d4d63',
              fontWeight: on ? '700' : '400',
              textTransform: 'uppercase', transition: 'all 0.15s',
              opacity: avail || on ? 1 : 0.45
            }}
          >
            {labelFn ? labelFn(v) : v}
          </button>
        );
      })}
    </div>
  );
}

export default function FilterPanel({
  filters, setFilters, toggleMultiFilter, clearFilters,
  yearsAvailable, familiesAvailable, openingsAvailable,
  timeClassesAvailable, rulesAvailable, monthsAvailable, ratedAvailable,
  activeYears, activeTimeClasses, activeColors, activeResults, activeRules, activeMonths, activeRated
}) {
  const { t, i18n } = useTranslation();
  const monthNames = MONTH_ABBR[i18n.language] || MONTH_ABBR.en;
  const monthLabel = (m) => monthNames[m - 1] || m;
  const resultLabel = (v) => t(`results.${v}`, v);
  const ratedLabel  = (v) => v === 1 ? t('filters.rated') : t('filters.unrated');

  const clearDate = () => setFilters({ ...filters, dateFrom: '', dateTo: '' });
  const hasDate = filters.dateFrom || filters.dateTo;

  return (
    <aside className="left-col">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 className="subtitle" style={{ margin: 0 }}>{t('filters.title')}</h3>
        <button onClick={clearFilters} style={{ background: 'transparent', color: '#60a5fa', border: 'none', cursor: 'pointer', fontSize: '11px' }}>
          {t('filters.clear')}
        </button>
      </div>

      {/* REGLAS */}
      {rulesAvailable.length > 1 && (
        <div className="filter-group">
          <label className="filter-label">{t('filters.rules')}</label>
          <MultiChip items={rulesAvailable} active={filters.rules} available={activeRules}
            onToggle={v => toggleMultiFilter('rules', v)} />
        </div>
      )}

      {/* RITMOS */}
      <div className="filter-group">
        <label className="filter-label">{t('filters.timeClass')}</label>
        <MultiChip items={timeClassesAvailable} active={filters.timeClasses} available={activeTimeClasses}
          onToggle={v => toggleMultiFilter('timeClasses', v)}
          labelFn={v => t(`timeClasses.${v}`, v)} />
      </div>

      {/* EVALUACIÓN */}
      {ratedAvailable.length > 1 && (
        <div className="filter-group">
          <label className="filter-label">{t('filters.evaluation')}</label>
          <MultiChip items={ratedAvailable} active={filters.rated} available={activeRated}
            onToggle={v => toggleMultiFilter('rated', v)}
            labelFn={ratedLabel} />
        </div>
      )}

      {/* RESULTADO */}
      <div className="filter-group">
        <label className="filter-label">{t('filters.result')}</label>
        <MultiChip items={['victoria', 'tablas', 'derrota']} active={filters.results} available={activeResults}
          onToggle={v => toggleMultiFilter('results', v)}
          labelFn={resultLabel} />
      </div>

      {/* COLOR */}
      <div className="filter-group">
        <label className="filter-label">{t('filters.pieces')}</label>
        <MultiChip items={['white', 'black']} active={filters.colors} available={activeColors}
          onToggle={v => toggleMultiFilter('colors', v)}
          labelFn={v => t(`colorLabels.${v}`, v)} />
      </div>

      {/* FAMILIA APERTURA */}
      <div className="filter-group">
        <label className="filter-label">{t('filters.openingFamily')}</label>
        <select className="filter-select" style={{ background: ITEM_BG }} value={filters.family}
          onChange={e => setFilters({ ...filters, family: e.target.value, opening: 'all' })}>
          <option value="all">{t('filters.all')}</option>
          {familiesAvailable.map(f => {
            const letter = FAMILY_LETTER[f] || '?';
            return <option key={f} value={f}>{letter} – {t(`ecoFamilies.${f}`, f)}</option>;
          })}
        </select>
      </div>

      {/* APERTURA */}
      <div className="filter-group">
        <label className="filter-label">{t('filters.opening')}</label>
        <select className="filter-select" style={{ background: ITEM_BG }} value={filters.opening}
          onChange={e => setFilters({ ...filters, opening: e.target.value })}>
          <option value="all">{t('filters.allOpenings')}</option>
          {openingsAvailable.map(op => {
            const display = getOpeningDisplay(op, i18n.language);
            return <option key={op} value={op}>{display.length > 38 ? display.slice(0, 37) + '…' : display}</option>;
          })}
        </select>
      </div>

      {/* AÑO */}
      <div className="filter-group">
        <label className="filter-label">{t('filters.year')}</label>
        <MultiChip items={yearsAvailable} active={filters.years} available={activeYears}
          onToggle={v => toggleMultiFilter('years', v)} />
      </div>

      {/* MES */}
      {monthsAvailable.length > 0 && (
        <div className="filter-group">
          <label className="filter-label">{t('filters.month')}</label>
          <MultiChip items={monthsAvailable} active={filters.months} available={activeMonths}
            onToggle={v => toggleMultiFilter('months', v)} labelFn={monthLabel} />
        </div>
      )}

      {/* RANGO DE FECHA */}
      <div className="filter-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <label className="filter-label" style={{ margin: 0 }}>{t('filters.dateRange')}</label>
          {hasDate && (
            <button onClick={clearDate} style={{
              background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer',
              fontSize: '9px', fontWeight: '700', padding: '2px 7px', borderRadius: '4px',
              textTransform: 'uppercase', letterSpacing: '0.05em'
            }}>✕ {t('filters.clear')}</button>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <input type="date" className="filter-select" style={{ background: ITEM_BG }}
            value={filters.dateFrom} onChange={e => setFilters({ ...filters, dateFrom: e.target.value })} />
          <input type="date" className="filter-select" style={{ background: ITEM_BG }}
            value={filters.dateTo} onChange={e => setFilters({ ...filters, dateTo: e.target.value })} />
        </div>
      </div>
    </aside>
  );
}
