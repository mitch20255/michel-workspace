import { google } from "googleapis";
import { AppTask, Priority } from "./types";
import { decodeNotes, encodeNotes } from "./notesMeta";

const TASKLIST_ID = "@default";
const EXTENDED_PROP_KEY = "googleTasksAiTaskId";

function oauthClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return auth;
}

function tasksClient(accessToken: string) {
  return google.tasks({ version: "v1", auth: oauthClient(accessToken) });
}

function calendarClient(accessToken: string) {
  return google.calendar({ version: "v3", auth: oauthClient(accessToken) });
}

export async function listTasks(accessToken: string): Promise<AppTask[]> {
  const tasks = tasksClient(accessToken);
  const res = await tasks.tasks.list({
    tasklist: TASKLIST_ID,
    showCompleted: false,
    showHidden: false,
    maxResults: 100,
  });
  const items = res.data.items ?? [];
  return items.map((item) => {
    const { notes, priority, estimatedMinutes } = decodeNotes(item.notes);
    return {
      id: item.id!,
      taskListId: TASKLIST_ID,
      title: item.title ?? "(sans titre)",
      notes,
      due: item.due ?? null,
      completed: item.status === "completed",
      priority,
      estimatedMinutes,
    };
  });
}

export async function createTask(
  accessToken: string,
  input: { title: string; notes?: string; due?: string | null }
): Promise<AppTask> {
  const tasks = tasksClient(accessToken);
  const res = await tasks.tasks.insert({
    tasklist: TASKLIST_ID,
    requestBody: {
      title: input.title,
      notes: input.notes || undefined,
      due: input.due || undefined,
    },
  });
  const { notes, priority, estimatedMinutes } = decodeNotes(res.data.notes);
  return {
    id: res.data.id!,
    taskListId: TASKLIST_ID,
    title: res.data.title ?? input.title,
    notes,
    due: res.data.due ?? null,
    completed: false,
    priority,
    estimatedMinutes,
  };
}

export async function patchTask(
  accessToken: string,
  taskId: string,
  input: {
    title?: string;
    plainNotes?: string;
    due?: string | null;
    completed?: boolean;
    priority?: Priority | null;
    estimatedMinutes?: number | null;
  }
): Promise<AppTask> {
  const tasks = tasksClient(accessToken);
  const current = await tasks.tasks.get({ tasklist: TASKLIST_ID, task: taskId });
  const decoded = decodeNotes(current.data.notes);

  const nextPlainNotes = input.plainNotes ?? decoded.notes;
  const nextPriority = input.priority !== undefined ? input.priority : decoded.priority;
  const nextEstimatedMinutes =
    input.estimatedMinutes !== undefined ? input.estimatedMinutes : decoded.estimatedMinutes;

  const res = await tasks.tasks.patch({
    tasklist: TASKLIST_ID,
    task: taskId,
    requestBody: {
      title: input.title,
      notes: encodeNotes(nextPlainNotes, nextPriority, nextEstimatedMinutes),
      due: input.due === undefined ? undefined : input.due || undefined,
      status: input.completed === undefined ? undefined : input.completed ? "completed" : "needsAction",
    },
  });

  const final = decodeNotes(res.data.notes);
  return {
    id: res.data.id!,
    taskListId: TASKLIST_ID,
    title: res.data.title ?? "",
    notes: final.notes,
    due: res.data.due ?? null,
    completed: res.data.status === "completed",
    priority: final.priority,
    estimatedMinutes: final.estimatedMinutes,
  };
}

export async function deleteTask(accessToken: string, taskId: string): Promise<void> {
  const tasks = tasksClient(accessToken);
  await tasks.tasks.delete({ tasklist: TASKLIST_ID, task: taskId });
}

export interface BusyInterval {
  start: string;
  end: string;
}

export async function getBusyIntervals(
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<BusyInterval[]> {
  const calendar = calendarClient(accessToken);
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: [{ id: "primary" }],
    },
  });
  const busy = res.data.calendars?.primary?.busy ?? [];
  return busy.map((b) => ({ start: b.start!, end: b.end! }));
}

export async function listScheduledTaskIds(
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<Set<string>> {
  const calendar = calendarClient(accessToken);
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin,
    timeMax,
    singleEvents: true,
    maxResults: 250,
  });
  const ids = new Set<string>();
  for (const event of res.data.items ?? []) {
    const taskId = event.extendedProperties?.private?.[EXTENDED_PROP_KEY];
    if (taskId) ids.add(taskId);
  }
  return ids;
}

export async function createScheduledEvent(
  accessToken: string,
  input: { taskId: string; title: string; start: string; end: string; notes?: string }
): Promise<{ id: string; htmlLink: string | null }> {
  const calendar = calendarClient(accessToken);
  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: `📝 ${input.title}`,
      description: input.notes,
      start: { dateTime: input.start },
      end: { dateTime: input.end },
      extendedProperties: {
        private: { [EXTENDED_PROP_KEY]: input.taskId },
      },
    },
  });
  return { id: res.data.id!, htmlLink: res.data.htmlLink ?? null };
}
