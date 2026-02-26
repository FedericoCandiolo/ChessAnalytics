import React from 'react';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal, Clock } from 'lucide-react';

export default function MobileFAB({ onFilterOpen, onHistoryOpen }) {
  const { t } = useTranslation();
  return (
    <div className="mobile-fab-bar">
      <button className="mobile-fab" onClick={onFilterOpen}>
        <SlidersHorizontal size={14} />
        {t('gameHistory.filters')}
      </button>
      <button className="mobile-fab" onClick={onHistoryOpen}>
        <Clock size={14} />
        {t('gameHistory.history')}
      </button>
    </div>
  );
}
