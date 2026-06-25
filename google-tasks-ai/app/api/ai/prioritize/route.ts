import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listTasks, patchTask } from "@/lib/google";
import { prioritizeTasks } from "@/lib/anthropic";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  try {
    const accessToken = session.accessToken;
    const tasks = await listTasks(accessToken);
    const incomplete = tasks.filter((t) => !t.completed);
    if (incomplete.length === 0) {
      return NextResponse.json({ tasks: [] });
    }

    const results = await prioritizeTasks(
      incomplete.map((t) => ({ id: t.id, title: t.title, notes: t.notes, due: t.due })),
      new Date().toISOString()
    );

    const updated = [];
    for (const result of results) {
      const task = await patchTask(accessToken, result.id, {
        priority: result.priority,
        estimatedMinutes: result.estimatedMinutes,
      });
      updated.push({ ...task, reason: result.reason });
    }
    return NextResponse.json({ tasks: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Échec de la priorisation" }, { status: 500 });
  }
}
