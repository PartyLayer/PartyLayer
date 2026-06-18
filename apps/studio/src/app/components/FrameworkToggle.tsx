'use client';

// Presentational segmented control for the framework-toggle scenario: React |
// Vue | Vanilla. No Sandpack — the parent swaps the scenario prop on change.
import { FRAMEWORK_OPTIONS, type FrameworkKey } from '../scenarios/frameworkScenario';

export function FrameworkToggle({
  framework,
  onChange,
}: {
  framework: FrameworkKey;
  onChange: (next: FrameworkKey) => void;
}) {
  return (
    <div className="mock-driver framework-toggle" role="group" aria-label="Framework">
      <span className="mock-driver-title">Framework</span>
      <div className="framework-toggle-seg">
        {FRAMEWORK_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={
              'framework-toggle-btn' + (opt.key === framework ? ' framework-toggle-btn--active' : '')
            }
            onClick={() => onChange(opt.key)}
            aria-pressed={opt.key === framework}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <span className="framework-toggle-note">Same connect demo — three frameworks, live.</span>
    </div>
  );
}
