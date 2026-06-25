export type Priority = "P1" | "P2" | "P3" | "P4";

export interface AppTask {
  id: string;
  taskListId: string;
  title: string;
  notes: string;
  due: string | null;
  completed: boolean;
  priority: Priority | null;
  estimatedMinutes: number | null;
}

export interface ScheduledBlock {
  taskId: string;
  title: string;
  start: string;
  end: string;
}
