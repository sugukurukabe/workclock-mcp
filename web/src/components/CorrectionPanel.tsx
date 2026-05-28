import { useState } from 'react';

interface CorrectionPanelProps {
  onAmend: (changes: { taskName?: string; note?: string }, reason: string) => void;
}

export function CorrectionPanel({ onAmend }: CorrectionPanelProps) {
  const [taskName, setTaskName] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');

  return (
    <section className="correction" aria-label="Correction panel">
      <h2>Amend last session</h2>
      <label>
        Task name
        <input value={taskName} onChange={(e) => setTaskName(e.target.value)} />
      </label>
      <label>
        Note
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <label>
        Reason (required)
        <input value={reason} onChange={(e) => setReason(e.target.value)} required />
      </label>
      <button
        type="button"
        disabled={!reason.trim()}
        onClick={() =>
          onAmend(
            {
              taskName: taskName || undefined,
              note: note || undefined,
            },
            reason.trim(),
          )
        }
      >
        Apply amendment
      </button>
    </section>
  );
}
