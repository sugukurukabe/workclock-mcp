import type { TodaySummary } from '../types.js';
import { formatDuration } from '../types.js';

export function TodaySummaryView({ today }: { today: TodaySummary }) {
  return (
    <section aria-label="Today summary">
      <h2>Today ({today.date})</h2>
      <p>Total: {formatDuration(today.totalActiveMs)}</p>
      <ul>
        {today.byTask.slice(0, 8).map((item) => (
          <li key={item.key}>
            {item.key}: {formatDuration(item.totalActiveMs)}
          </li>
        ))}
      </ul>
    </section>
  );
}
