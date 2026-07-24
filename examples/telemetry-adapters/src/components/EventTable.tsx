/**
 * Live table of telemetry records from the console adapter. It subscribes to the
 * adapter's buffer and re-renders as records arrive, showing the kind, name,
 * properties, and time of each. This is the demonstrable proof that events reach the
 * telemetry surface: every row is one `track`, `increment`, `gauge`, or `error` call.
 */
import { useSyncExternalStore } from 'react';
import type { ConsoleTelemetryAdapter, TelemetryEntry } from '../adapters/consoleAdapter';

function formatProperties(properties?: Record<string, unknown>): string {
  if (!properties || Object.keys(properties).length === 0) return '';
  return JSON.stringify(properties);
}

export function EventTable({ adapter }: { adapter: ConsoleTelemetryAdapter }) {
  const entries = useSyncExternalStore(
    (listener) => adapter.subscribe(listener),
    () => adapter.getEntries(),
  );

  const rows: TelemetryEntry[] = [...entries].reverse();

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Telemetry records</h2>
        <button className="button" onClick={() => adapter.clear()} disabled={rows.length === 0}>
          Clear
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="muted">No records yet. Connect a wallet, or wait for the registry read on load.</p>
      ) : (
        <table className="event-table">
          <thead>
            <tr>
              <th>Kind</th>
              <th>Name</th>
              <th>Properties</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry, index) => (
              <tr key={index} data-testid="event-row">
                <td>{entry.kind}</td>
                <td className="event-name">{entry.name}</td>
                <td className="event-props">{formatProperties(entry.properties)}</td>
                <td>{new Date(entry.timestamp).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default EventTable;
