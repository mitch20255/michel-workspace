import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createTask, listTasks } from "@/lib/google";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  try {
    const tasks = await listTasks(session.accessToken);
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Échec de la récupération des tâches" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const body = await req.json();
  if (!body.title || typeof body.title !== "string") {
    return NextResponse.json({ error: "Titre manquant" }, { status: 400 });
  }
  try {
    const task = await createTask(session.accessToken, {
      title: body.title,
      notes: body.notes,
      due: body.due,
    });
    return NextResponse.json({ task });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Échec de la création" }, { status: 500 });
  }
}
