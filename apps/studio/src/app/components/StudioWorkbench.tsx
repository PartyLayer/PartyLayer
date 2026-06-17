'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { connectScenario } from '../scenarios/connectScenario';
import { submitScenario } from '../scenarios/submitScenario';
import { signScenario } from '../scenarios/signScenario';

// Sandpack touches browser APIs → load client-only (no SSR/prerender attempt).
const ScenarioSandpack = dynamic(
  () => import('./ScenarioSandpack').then((m) => m.ScenarioSandpack),
  { ssr: false, loading: () => <div className="scenario-loading">Loading live preview…</div> },
);

type ScenarioKey = 'connect' | 'sign' | 'submit';

const SCENARIOS: { key: ScenarioKey; label: string; ready: boolean }[] = [
  { key: 'connect', label: 'Connect a wallet', ready: true },
  { key: 'sign', label: 'Sign a message', ready: true },
  { key: 'submit', label: 'Submit a transaction', ready: true },
];

export function StudioWorkbench() {
  const [selected, setSelected] = useState<ScenarioKey>('connect');

  return (
    <div className="studio">
      <header className="studio-header">
        <div className="studio-brand">
          <span className="studio-logo" aria-hidden="true">◆</span>
          <span className="studio-title">PartyLayer Studio</span>
        </div>
        <p className="studio-subtitle">Live, runnable PartyLayer patterns</p>
      </header>

      <div className="studio-body">
        <nav className="studio-rail" aria-label="Scenarios">
          <p className="studio-rail-heading">Scenarios</p>
          <ul className="studio-rail-list">
            {SCENARIOS.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  className={
                    'studio-rail-item' +
                    (s.key === selected ? ' studio-rail-item--active' : '') +
                    (s.ready ? '' : ' studio-rail-item--placeholder')
                  }
                  onClick={() => s.ready && setSelected(s.key)}
                  disabled={!s.ready}
                  aria-current={s.key === selected ? 'true' : undefined}
                >
                  {s.label}
                  {!s.ready && <span className="studio-rail-soon">soon</span>}
                </button>
              </li>
            ))}
          </ul>
          <p className="studio-rail-note">More patterns arrive next.</p>
        </nav>

        <main className="studio-main">
          {selected === 'connect' ? (
            <ScenarioSandpack scenario={connectScenario} />
          ) : selected === 'submit' ? (
            <ScenarioSandpack scenario={submitScenario} />
          ) : (
            <ScenarioSandpack scenario={signScenario} />
          )}
        </main>
      </div>
    </div>
  );
}
