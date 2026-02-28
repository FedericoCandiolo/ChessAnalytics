import React, { useState, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ChartSlider({ slides }) {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(null);

  const go = useCallback((idx) => {
    setCurrent(Math.max(0, Math.min(slides.length - 1, idx)));
  }, [slides.length]);

  const prev = () => go(current - 1);
  const next = () => go(current + 1);

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 50) delta < 0 ? next() : prev();
    touchStartX.current = null;
  };

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  return (
    <div className="chart-slider" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Track */}
      <div className="chart-slider-track" style={{ transform: `translateX(-${current * 100}%)` }}>
        {slides.map((slide, i) => (
          <div key={i} className="chart-slide">
            {slide.node}
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="slider-nav">
        <button className="slider-arrow" onClick={prev} disabled={current === 0} aria-label="Anterior">
          <ChevronLeft size={18} />
        </button>

        <div className="slider-dots">
          {slides.map((slide, i) => (
            <button
              key={i}
              className={`slider-dot${current === i ? ' active' : ''}`}
              onClick={() => go(i)}
              aria-label={slide.label}
              title={slide.label}
            />
          ))}
        </div>

        <span className="slider-label">{slides[current]?.label}</span>

        <button className="slider-arrow" onClick={next} disabled={current === slides.length - 1} aria-label="Siguiente">
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
