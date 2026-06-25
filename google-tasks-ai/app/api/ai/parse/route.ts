import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createTask } from "@/lib/google";
import { parseTaskFromText } from "@/lib/anthropic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { text } = await req.json();
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Texte manquant" }, { status: 400 });
  }
  try {
    const parsed = await parseTaskFromText(text, new Date().toISOString());
    const task = await createTask(session.accessToken, parsed);
    return NextResponse.json({ task });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Échec de la création de la tâche" }, { status: 500 });
  }
}
