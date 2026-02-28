import React from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { RESULT_COLORS } from '../constants';

const ITEM_BG = '#2d333f';

const MONTH_ABBR = {
  es: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
  en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
};

function MultiChip({ items, active, onToggle, labelFn, available }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
      {items.map(v => {
        const on = active.includes(v);
        const avail = !available || available.has(v);
        return (
          <button
            key={v}
            onClick={() => avail || on ? onToggle(v) : undefined}
            style={{
              padding: '5px 9px', borderRadius: '4px',
              border: `1px solid ${on ? RESULT_COLORS.win : avail ? '#334155' : '#1e2533'}`,
              fontSize: '11px', cursor: avail || on ? 'pointer' : 'default',
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

export default function FilterDrawer({
  isOpen, onClose, filters, setFilters, toggleMultiFilter, clearFilters,
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
    <>
      {isOpen && <div className="drawer-overlay" onClick={onClose} />}
      <div className={`filter-drawer${isOpen ? ' open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>{t('filters.title')}</h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={clearFilters} style={{ background: 'transparent', color: '#60a5fa', border: 'none', cursor: 'pointer', fontSize: '12px' }}>
              {t('filters.clear')}
            </button>
            <button onClick={onClose} style={{ background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {rulesAvailable.length > 1 && (
          <div className="filter-group">
            <label className="filter-label">{t('filters.rules')}</label>
            <MultiChip items={rulesAvailable} active={filters.rules} available={activeRules}
              onToggle={v => toggleMultiFilter('rules', v)} />
          </div>
        )}

        <div className="filter-group">
          <label className="filter-label">{t('filters.timeClass')}</label>
          <MultiChip items={timeClassesAvailable} active={filters.timeClasses} available={activeTimeClasses}
            onToggle={v => toggleMultiFilter('timeClasses', v)}
            labelFn={v => t(`timeClasses.${v}`, v)} />
        </div>

        {ratedAvailable.length > 1 && (
          <div className="filter-group">
            <label className="filter-label">{t('filters.evaluation')}</label>
            <MultiChip items={ratedAvailable} active={filters.rated} available={activeRated}
              onToggle={v => toggleMultiFilter('rated', v)}
              labelFn={ratedLabel} />
          </div>
        )}

        <div className="filter-group">
          <label className="filter-label">{t('filters.result')}</label>
          <MultiChip items={['victoria', 'tablas', 'derrota']} active={filters.results} available={activeResults}
            onToggle={v => toggleMultiFilter('results', v)}
            labelFn={resultLabel} />
        </div>

        <div className="filter-group">
          <label className="filter-label">{t('filters.pieces')}</label>
          <MultiChip items={['white', 'black']} active={filters.colors} available={activeColors}
            onToggle={v => toggleMultiFilter('colors', v)}
            labelFn={v => t(`colorLabels.${v}`, v)} />
        </div>

        <div className="filter-group">
          <label className="filter-label">{t('filters.openingFamily')}</label>
          <select className="filter-select" style={{ background: ITEM_BG }} value={filters.family}
            onChange={e => setFilters({ ...filters, family: e.target.value, opening: 'all' })}>
            <option value="all">{t('filters.all')}</option>
            {familiesAvailable.map(f => <option key={f} value={f}>{t(`ecoFamilies.${f}`, f)}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">{t('filters.opening')}</label>
          <select className="filter-select" style={{ background: ITEM_BG }} value={filters.opening}
            onChange={e => setFilters({ ...filters, opening: e.target.value })}>
            <option value="all">{t('filters.allOpenings')}</option>
            {openingsAvailable.map(op => <option key={op} value={op}>{op.length > 40 ? op.slice(0, 39) + '…' : op}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">{t('filters.year')}</label>
          <MultiChip items={yearsAvailable} active={filters.years} available={activeYears}
            onToggle={v => toggleMultiFilter('years', v)} />
        </div>

        {monthsAvailable.length > 0 && (
          <div className="filter-group">
            <label className="filter-label">{t('filters.month')}</label>
            <MultiChip items={monthsAvailable} active={filters.months} available={activeMonths}
              onToggle={v => toggleMultiFilter('months', v)} labelFn={monthLabel} />
          </div>
        )}

        <div className="filter-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="filter-label" style={{ margin: 0 }}>{t('filters.dateRange')}</label>
            {hasDate && (
              <button onClick={clearDate} style={{
                background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer',
                fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px',
                textTransform: 'uppercase'
              }}>✕ {t('filters.clear')}</button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '10px', color: '#94a3b8' }}>{t('filters.dateFrom')}</label>
            <input type="date" className="filter-select" style={{ background: ITEM_BG }}
              value={filters.dateFrom} onChange={e => setFilters({ ...filters, dateFrom: e.target.value })} />
            <label style={{ fontSize: '10px', color: '#94a3b8' }}>{t('filters.dateTo')}</label>
            <input type="date" className="filter-select" style={{ background: ITEM_BG }}
              value={filters.dateTo} onChange={e => setFilters({ ...filters, dateTo: e.target.value })} />
          </div>
        </div>
      </div>
    </>
  );
}
