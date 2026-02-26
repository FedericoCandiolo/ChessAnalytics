import React from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { RITMOS, RESULT_COLORS } from '../constants';

export default function FilterDrawer({ isOpen, onClose, filters, setFilters, toggleMultiFilter, clearFilters, yearsAvailable, familiesAvailable }) {
  const { t } = useTranslation();
  const ITEM_BG = '#2d333f';

  return (
    <>
      {isOpen && (
        <div className="drawer-overlay" onClick={onClose} />
      )}
      <div className={`filter-drawer${isOpen ? ' open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
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

        <div className="filter-group">
          <label className="filter-label">{t('filters.years')}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {yearsAvailable.map(y => (
              <button key={y} onClick={() => toggleMultiFilter('years', y)} style={{
                padding: '4px 8px', borderRadius: '4px', border: '1px solid #334155', fontSize: '11px', cursor: 'pointer',
                background: filters.years.includes(y) ? RESULT_COLORS.win : '#0f172a',
                color: filters.years.includes(y) ? '#000' : 'white',
                fontWeight: filters.years.includes(y) ? 'bold' : 'normal'
              }}>{y}</button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <label className="filter-label">{t('filters.timeClass')}</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {RITMOS.map(r => (
              <button key={r} onClick={() => toggleMultiFilter('timeClasses', r)} style={{
                flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #334155', fontSize: '10px', cursor: 'pointer',
                background: filters.timeClasses.includes(r) ? RESULT_COLORS.win : '#0f172a',
                color: filters.timeClasses.includes(r) ? '#000' : 'white',
                fontWeight: filters.timeClasses.includes(r) ? 'bold' : 'normal',
                textTransform: 'uppercase'
              }}>{r}</button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <label className="filter-label">{t('filters.pieces')}</label>
          <select className="filter-select" style={{ background: ITEM_BG }} value={filters.color} onChange={e => setFilters({ ...filters, color: e.target.value })}>
            <option value="all">{t('filters.both')}</option>
            <option value="white">{t('filters.white')}</option>
            <option value="black">{t('filters.black')}</option>
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">{t('filters.ecoFamily')}</label>
          <select className="filter-select" style={{ background: ITEM_BG }} value={filters.family} onChange={e => setFilters({ ...filters, family: e.target.value, opening: 'all' })}>
            <option value="all">{t('filters.all')}</option>
            {familiesAvailable.map(f => <option key={f} value={f}>{t(`ecoFamilies.${f}`, f)}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">{t('filters.result')}</label>
          <select className="filter-select" style={{ background: ITEM_BG }} value={filters.result} onChange={e => setFilters({ ...filters, result: e.target.value })}>
            <option value="all">{t('filters.allResults')}</option>
            <option value="victoria">{t('filters.wins')}</option>
            <option value="derrota">{t('filters.losses')}</option>
            <option value="tablas">{t('filters.draws')}</option>
          </select>
        </div>
      </div>
    </>
  );
}
