import type { Priority, Status } from '../types';
import { PRIORITY_LABELS, STATUS_LABELS } from '../types';

// WHY one dumb component for both badge kinds: they only differ by label map
// and CSS class — the enum value doubles as the class name (e.g. "badge open").
export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge status-${status}`}>{STATUS_LABELS[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`badge priority-${priority}`}>{PRIORITY_LABELS[priority]}</span>;
}
