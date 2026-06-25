import { AppTask, ScheduledBlock } from "./types";
import { BusyInterval } from "./google";

interface WorkHours {
  startHour: number;
  endHour: number;
}

interface Range {
  start: number;
  end: number;
}

const PRIORITY_ORDER: Record<string, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };
const DEFAULT_DURATION_MIN = 30;
const DEFAULT_WORK_HOURS: WorkHours = { startHour: 9, endHour: 17 };

export function scheduleTasks(
  tasks: AppTask[],
  busy: BusyInterval[],
  options: { windowStart: Date; windowEnd: Date; workHours?: WorkHours }
): ScheduledBlock[] {
  const workHours = options.workHours ?? DEFAULT_WORK_HOURS;

  const sorted = [...tasks].sort((a, b) => {
    const pa = a.priority ? PRIORITY_ORDER[a.priority] : 4;
    const pb = b.priority ? PRIORITY_ORDER[b.priority] : 4;
    if (pa !== pb) return pa - pb;
    const da = a.due ? new Date(a.due).getTime() : Infinity;
    const db = b.due ? new Date(b.due).getTime() : Infinity;
    return da - db;
  });

  const busyRanges: Range[] = busy
    .map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }))
    .sort((a, b) => a.start - b.start);

  const results: ScheduledBlock[] = [];

  for (const task of sorted) {
    const durationMin = task.estimatedMinutes ?? DEFAULT_DURATION_MIN;
    const deadline = task.due ? new Date(task.due).getTime() : options.windowEnd.getTime();
    const limit = Math.min(deadline, options.windowEnd.getTime());

    const slot = findFreeSlot(
      options.windowStart.getTime(),
      limit,
      durationMin,
      workHours,
      busyRanges
    );
    if (slot) {
      results.push({
        taskId: task.id,
        title: task.title,
        start: new Date(slot.start).toISOString(),
        end: new Date(slot.end).toISOString(),
      });
      busyRanges.push(slot);
      busyRanges.sort((a, b) => a.start - b.start);
    }
  }

  return results;
}

function findFreeSlot(
  rangeStart: number,
  rangeEnd: number,
  durationMin: number,
  workHours: WorkHours,
  busy: Range[]
): Range | null {
  const durationMs = durationMin * 60 * 1000;
  let cursor = roundUpToQuarterHour(rangeStart);
  let guard = 0;

  while (cursor + durationMs <= rangeEnd) {
    if (++guard > 10000) return null; // safety valve against infinite loops

    const cursorDate = new Date(cursor);
    const hour = cursorDate.getHours();
    const day = cursorDate.getDay();

    if (day === 0 || day === 6) {
      cursor = nextDayAt(cursorDate, workHours.startHour);
      continue;
    }
    if (hour < workHours.startHour) {
      cursor = setHour(cursorDate, workHours.startHour);
      continue;
    }
    if (hour >= workHours.endHour) {
      cursor = nextDayAt(cursorDate, workHours.startHour);
      continue;
    }

    const slotEnd = cursor + durationMs;
    const endOfDay = setHour(cursorDate, workHours.endHour);
    if (slotEnd > endOfDay) {
      cursor = nextDayAt(cursorDate, workHours.startHour);
      continue;
    }

    const conflict = busy.find((b) => cursor < b.end && slotEnd > b.start);
    if (conflict) {
      cursor = roundUpToQuarterHour(conflict.end);
      continue;
    }

    return { start: cursor, end: slotEnd };
  }

  return null;
}

function roundUpToQuarterHour(ms: number): number {
  const quarterMs = 15 * 60 * 1000;
  return Math.ceil(ms / quarterMs) * quarterMs;
}

function setHour(date: Date, hour: number): number {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

function nextDayAt(date: Date, hour: number): number {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}
