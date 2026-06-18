'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { StudioScenario } from '../scenarios/types';
import { connectScenario } from '../scenarios/connectScenario';
import { submitScenario } from '../scenarios/submitScenario';
import { signScenario } from '../scenarios/signScenario';
import {
  resilienceReconnectScenario,
  resilienceDisconnectScenario,
} from '../scenarios/resilienceScenarios';
import { reactQueryScenario } from '../scenarios/reactQueryScenario';
import {
  FRAMEWORK_VARIANTS,
  frameworkReactScenario,
  type FrameworkKey,
} from '../scenarios/frameworkScenario';
import { FrameworkToggle } from './FrameworkToggle';

// Sandpack touches browser APIs → load client-only (no SSR/prerender attempt).
const ScenarioSandpack = dynamic(
  () => import('./ScenarioSandpack').then((m) => m.ScenarioSandpack),
  { ssr: false, loading: () => <div className="scenario-loading">Loading live preview…</div> },
);

type ScenarioKey =
  | 'connect'
  | 'sign'
  | 'submit'
  | 'reconnect'
  | 'disconnect'
  | 'react-query'
  | 'framework';

// The framework item is special-cased in render (toggle + variant), so its
// `scenario` here is only the default rail target.
const SCENARIOS: { key: ScenarioKey; label: string; ready: boolean; scenario: StudioScenario }[] = [
  { key: 'connect', label: 'Connect a wallet', ready: true, scenario: connectScenario },
  { key: 'sign', label: 'Sign a message', ready: true, scenario: signScenario },
  { key: 'submit', label: 'Submit a transaction', ready: true, scenario: submitScenario },
  { key: 'reconnect', label: 'Session resilience — reconnect', ready: true, scenario: resilienceReconnectScenario },
  { key: 'disconnect', label: 'Session resilience — disconnect', ready: true, scenario: resilienceDisconnectScenario },
  { key: 'react-query', label: 'React Query + DevTools', ready: true, scenario: reactQueryScenario },
  { key: 'framework', label: 'Framework toggle', ready: true, scenario: frameworkReactScenario },
];

export function StudioWorkbench() {
  const [selected, setSelected] = useState<ScenarioKey>('connect');
  const [framework, setFramework] = useState<FrameworkKey>('react');
  const activeScenario =
    SCENARIOS.find((s) => s.key === selected)?.scenario ?? connectScenario;

  return (
    <div className="studio">
      <header className="studio-header">
        <div className="studio-brand">
          <span className="studio-logo" aria-hidden="true">
            <img src="/favicon-new.svg" alt="" width={34} height={34} className="studio-logo-mark" />
          </span>
          <div className="studio-wordmark">
            <span className="studio-title">
              PartyLayer <span className="studio-title-sub">Studio</span>
            </span>
            <span className="studio-subtitle">Interactive pattern workbench</span>
          </div>
        </div>
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
          {selected === 'framework' ? (
            <div className="scenario-sandpack">
              <FrameworkToggle framework={framework} onChange={setFramework} />
              <ScenarioSandpack key={'framework-' + framework} scenario={FRAMEWORK_VARIANTS[framework]} />
            </div>
          ) : (
            <ScenarioSandpack key={selected} scenario={activeScenario} />
          )}
        </main>
      </div>
    </div>
  );
}
