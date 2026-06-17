'use client';

// Presentational mock-driver controls: a failure-scenario dropdown + a connect
// delay (ms). Pure props (value + onChange) — it does NOT touch Sandpack; the
// wiring (sandpack.updateFile) lives in ScenarioSandpack's DriverControls.
import { MOCK_FAILURE_SCENARIOS, type MockDriverConfig } from '../scenarios/connectScenario';

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
        <select
          value={config.failConnect ?? ''}
          onChange={(e) => onChange({ ...config, failConnect: e.target.value || null })}
        >
          {MOCK_FAILURE_SCENARIOS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
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
