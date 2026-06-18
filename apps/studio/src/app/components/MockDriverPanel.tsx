'use client';

// Presentational mock-driver controls: a failure-scenario picker (a CUSTOM
// styled dropdown — no native <select>) + a connect delay (ms). Pure props
// (value + onChange) — it does NOT touch Sandpack; the wiring lives in
// ScenarioSandpack's DriverControls.
import { useEffect, useId, useRef, useState } from 'react';
import { MOCK_FAILURE_SCENARIOS, type MockDriverConfig } from '../scenarios/connectScenario';

function Chevron() {
  return (
    <svg
      className="pl-select-chevron"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Custom listbox dropdown — styled, keyboard-accessible, click-outside to close. */
function CustomSelect({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (next: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const selected = options[selectedIndex];

  // Click-outside closes.
  useEffect(() => {
    if (!open) return;
    function onDocPointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocPointer);
    return () => document.removeEventListener('mousedown', onDocPointer);
  }, [open]);

  function openMenu() {
    setActiveIndex(selectedIndex);
    setOpen(true);
  }

  function commit(index: number) {
    const opt = options[index];
    if (opt) onChange(opt.value);
    setOpen(false);
  }

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openMenu();
      return;
    }
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      commit(activeIndex);
    }
  }

  return (
    <div className="pl-select" ref={rootRef}>
      <button
        type="button"
        className="pl-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
      >
        <span>{selected?.label}</span>
        <Chevron />
      </button>
      {open && (
        <ul className="pl-select-menu" role="listbox" id={listId} aria-label={label}>
          {options.map((opt, i) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={
                'pl-select-option' +
                (opt.value === value ? ' pl-select-option--selected' : '') +
                (i === activeIndex ? ' pl-select-option--active' : '')
              }
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => commit(i)}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MockDriverPanel({
  config,
  onChange,
}: {
  config: MockDriverConfig;
  onChange: (next: MockDriverConfig) => void;
}) {
  return (
    <div className="mock-driver">
      <span className="mock-driver-title">Mock driver</span>
      <label className="mock-driver-field">
        Failure
        <CustomSelect
          label="Failure scenario"
          value={config.failConnect ?? ''}
          options={MOCK_FAILURE_SCENARIOS}
          onChange={(next) => onChange({ ...config, failConnect: next || null })}
        />
      </label>
      <label className="mock-driver-field">
        Connect delay (ms)
        <input
          type="number"
          min={0}
          step={250}
          value={config.connectDelayMs}
          onChange={(e) => onChange({ ...config, connectDelayMs: Math.max(0, Number(e.target.value) || 0) })}
        />
      </label>
    </div>
  );
}
