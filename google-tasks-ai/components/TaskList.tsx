import { AppTask } from "@/lib/types";
import { PriorityBadge } from "./PriorityBadge";

export function TaskList({
  tasks,
  onToggleComplete,
  onDelete,
}: {
  tasks: AppTask[];
  onToggleComplete: (task: AppTask) => void;
  onDelete: (task: AppTask) => void;
}) {
  if (tasks.length === 0) {
    return <p className="text-gray-500">Aucune tâche pour le moment.</p>;
  }

  return (
    <ul className="space-y-2">
      {tasks.map((task) => (
        <li
          key={task.id}
          className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3"
        >
          <input
            type="checkbox"
            checked={task.completed}
            onChange={() => onToggleComplete(task)}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={task.completed ? "line-through text-gray-400" : "font-medium"}>
                {task.title}
              </span>
              <PriorityBadge priority={task.priority} />
              {task.estimatedMinutes && (
                <span className="text-xs text-gray-400">{task.estimatedMinutes} min</span>
              )}
            </div>
            {task.notes && <p className="text-sm text-gray-500 mt-1">{task.notes}</p>}
            {task.due && (
              <p className="text-xs text-gray-400 mt-1">
                Échéance : {new Date(task.due).toLocaleDateString("fr-CA")}
              </p>
            )}
          </div>
          <button
            onClick={() => onDelete(task)}
            className="text-gray-400 hover:text-red-600 text-sm"
            aria-label="Supprimer"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}
