import { useState, useEffect } from 'react';
import { useCantonConnect } from '@cantonconnect/react';
import type { CantonConnectEvent } from '@cantonconnect/sdk';
import './EventLog.css';

interface EventEntry {
  timestamp: number;
  event: CantonConnectEvent;
}

function EventLog() {
  const client = useCantonConnect();
  const [events, setEvents] = useState<EventEntry[]>([]);

  useEffect(() => {
    if (!client) return;

    const handleEvent = (event: CantonConnectEvent) => {
      setEvents((prev) => [
        { timestamp: Date.now(), event },
        ...prev.slice(0, 49), // Keep last 50 events
      ]);
    };

    // Subscribe to all events
    client.on('session:connected', handleEvent);
    client.on('session:disconnected', handleEvent);
    client.on('registry:status', handleEvent);
    client.on('error', handleEvent);

    return () => {
      // Cleanup subscriptions
      client.off('session:connected', handleEvent);
      client.off('session:disconnected', handleEvent);
      client.off('registry:status', handleEvent);
      client.off('error', handleEvent);
    };
  }, [client]);

  return (
    <div className="panel full-width">
      <h2>Event Log</h2>
      <div className="event-log">
        {events.length === 0 ? (
          <div style={{ color: '#888', fontStyle: 'italic' }}>
            No events yet. Connect a wallet to see events.
          </div>
        ) : (
          events.map((entry, index) => (
            <div key={index} className="event-entry">
              <div className="event-timestamp">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </div>
              <div className="event-name">{entry.event.type}</div>
              <div className="event-payload">
                {JSON.stringify(entry.event, null, 2)}
              </div>
            </div>
          ))
        )}
      </div>
      {events.length > 0 && (
        <button
          className="button"
          onClick={() => setEvents([])}
          style={{ marginTop: '12px', padding: '8px 16px', fontSize: '0.9rem' }}
        >
          Clear Log
        </button>
      )}
    </div>
  );
}

export default EventLog;
