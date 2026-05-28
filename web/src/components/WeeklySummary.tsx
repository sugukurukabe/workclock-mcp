import type { TodaySummary } from '../types.js';
import { formatDuration } from '../types.js';

export function WeeklySummaryView({ groups }: { groups: TodaySummary['byTask'] }) {
  return (
    <section aria-label="Weekly summary">
      <h2>This week</h2>
      <ul>
        {groups.slice(0, 12).map((item) => (
          <li key={item.key}>
            {item.key}: {formatDuration(item.totalActiveMs)} ({item.sessionCount})
          </li>
        ))}
      </ul>
    </section>
  );
}
