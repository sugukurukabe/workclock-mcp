import { useEffect, useMemo, useState } from 'react';
import { createBridge } from './bridge.js';
import { TimerCard } from './components/TimerCard.js';
import { TodaySummaryView } from './components/TodaySummary.js';
import { WeeklySummaryView } from './components/WeeklySummary.js';
import { MarkdownPreview } from './components/MarkdownPreview.js';
import { CorrectionPanel } from './components/CorrectionPanel.js';
import type { WorkClockEnvelope } from './types.js';
import { computeElapsedMs } from './types.js';

const emptyToday = {
  date: new Date().toISOString().slice(0, 10),
  totalActiveMs: 0,
  byTask: [],
  sessionCount: 0,
};

export function App() {
  const bridge = useMemo(() => createBridge(), []);
  const [envelope, setEnvelope] = useState<WorkClockEnvelope | null>(null);
  const [tab, setTab] = useState<'timer' | 'summary' | 'correct'>('timer');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    bridge.onResult(setEnvelope);
    void refresh();
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const sync = window.setInterval(() => void refresh(), 15000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(sync);
    };
  }, [bridge]);

  async function refresh() {
    const result = await bridge.callTool('timelog.status', { includeTodaySummary: true });
    if (result) setEnvelope(result);
  }

  const activeSession = envelope?.activeSession ?? null;
  const today = envelope?.today ?? emptyToday;
  const elapsedMs = activeSession ? computeElapsedMs(activeSession, now) : 0;
  const paused = activeSession?.pausedAtEpochMs !== undefined;

  return (
    <main className="app">
      <nav className="tabs" aria-label="Sections">
        <button type="button" className={tab === 'timer' ? 'active' : ''} onClick={() => setTab('timer')}>
          Timer
        </button>
        <button type="button" className={tab === 'summary' ? 'active' : ''} onClick={() => setTab('summary')}>
          Summary
        </button>
        <button type="button" className={tab === 'correct' ? 'active' : ''} onClick={() => setTab('correct')}>
          Correct
        </button>
      </nav>

      {tab === 'timer' && (
        <TimerCard
          activeSession={activeSession}
          today={today}
          elapsedMs={elapsedMs}
          paused={paused}
          onPause={() => void bridge.callTool('timelog.pause', { breakType: 'manual' }).then(setEnvelope)}
          onResume={() => void bridge.callTool('timelog.resume', {}).then(setEnvelope)}
          onStop={() => void bridge.callTool('timelog.stop', { outcome: 'stopped' }).then(setEnvelope)}
          onRefresh={() => void refresh()}
        />
      )}

      {tab === 'summary' && (
        <>
          <TodaySummaryView today={today} />
          <WeeklySummaryView groups={today.byTask} />
          {envelope?.markdown && <MarkdownPreview markdown={envelope.markdown} />}
        </>
      )}

      {tab === 'correct' && (
        <CorrectionPanel
          onAmend={(changes, reason) =>
            void bridge
              .callTool('timelog.amend', { target: 'last', changes, reason })
              .then(setEnvelope)
          }
        />
      )}

      {!bridge.available && <p className="bridge-warning">MCP Apps bridge unavailable (standalone preview mode).</p>}
    </main>
  );
}
