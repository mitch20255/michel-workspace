import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createScheduledEvent,
  getBusyIntervals,
  listScheduledTaskIds,
  listTasks,
} from "@/lib/google";
import { scheduleTasks } from "@/lib/scheduling";

const WINDOW_DAYS = 7;

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  try {
    const accessToken = session.accessToken;
    const tasks = await listTasks(accessToken);

    const windowStart = new Date();
    const windowEnd = new Date(windowStart.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [busy, scheduledIds] = await Promise.all([
      getBusyIntervals(accessToken, windowStart.toISOString(), windowEnd.toISOString()),
      listScheduledTaskIds(accessToken, windowStart.toISOString(), windowEnd.toISOString()),
    ]);

    const candidates = tasks.filter((t) => !t.completed && !scheduledIds.has(t.id));
    const blocks = scheduleTasks(candidates, busy, { windowStart, windowEnd });

    const created = [];
    for (const block of blocks) {
      const event = await createScheduledEvent(accessToken, {
        taskId: block.taskId,
        title: block.title,
        start: block.start,
        end: block.end,
      });
      created.push({ ...block, eventId: event.id, htmlLink: event.htmlLink });
    }

    return NextResponse.json({
      scheduled: created,
      unscheduledCount: candidates.length - created.length,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Échec de la planification" }, { status: 500 });
  }
}
