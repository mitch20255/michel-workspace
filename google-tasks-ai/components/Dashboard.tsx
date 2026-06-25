"use client";

import { useEffect, useState } from "react";
import { AppTask } from "@/lib/types";
import { TaskInput } from "./TaskInput";
import { TaskList } from "./TaskList";
import { SignOutButton } from "./SignOutButton";

export function Dashboard() {
  const [tasks, setTasks] = useState<AppTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadTasks() {
    setLoading(true);
    const res = await fetch("/api/tasks");
    const data = await res.json();
    setTasks(data.tasks ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadTasks();
  }, []);

  async function handleAddTask(text: string) {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/ai/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      await loadTasks();
    } else {
      setMessage("Erreur lors de la création de la tâche.");
    }
    setBusy(false);
  }

  async function handlePrioritize() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/ai/prioritize", { method: "POST" });
    if (res.ok) {
      setMessage("Priorités mises à jour par l'IA.");
      await loadTasks();
    } else {
      setMessage("Erreur lors de la priorisation.");
    }
    setBusy(false);
  }

  async function handleSchedule() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/ai/schedule", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setMessage(
        `${data.scheduled.length} bloc(s) planifié(s) dans Google Calendar` +
          (data.unscheduledCount > 0 ? ` (${data.unscheduledCount} tâche(s) sans créneau disponible).` : ".")
      );
    } else {
      setMessage("Erreur lors de la planification.");
    }
    setBusy(false);
  }

  async function handleToggleComplete(task: AppTask) {
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !task.completed }),
    });
    await loadTasks();
  }

  async function handleDelete(task: AppTask) {
    await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    await loadTasks();
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Mes tâches</h1>
        <SignOutButton />
      </div>

      <TaskInput onSubmit={handleAddTask} disabled={busy} />

      <div className="my-4 flex gap-3">
        <button
          onClick={handlePrioritize}
          disabled={busy}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
        >
          Prioriser avec l&apos;IA
        </button>
        <button
          onClick={handleSchedule}
          disabled={busy}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          Planifier dans Calendar
        </button>
      </div>

      {message && <p className="mb-4 text-sm text-gray-600">{message}</p>}

      {loading ? (
        <p className="text-gray-500">Chargement...</p>
      ) : (
        <TaskList tasks={tasks} onToggleComplete={handleToggleComplete} onDelete={handleDelete} />
      )}
    </main>
  );
}
