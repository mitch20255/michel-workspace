import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteTask, patchTask } from "@/lib/google";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const body = await req.json();
  try {
    const task = await patchTask(session.accessToken, params.id, {
      title: body.title,
      plainNotes: body.notes,
      due: body.due,
      completed: body.completed,
      priority: body.priority,
      estimatedMinutes: body.estimatedMinutes,
    });
    return NextResponse.json({ task });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Échec de la mise à jour" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  try {
    await deleteTask(session.accessToken, params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Échec de la suppression" }, { status: 500 });
  }
}
