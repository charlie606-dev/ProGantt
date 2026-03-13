import { Task } from '../types';
import { startOfDay, addDays, parseISO, formatISO } from 'date-fns';

export interface ColumnWidths {
  wbs: number;
  name: number;
  start: number;
  end: number;
  duration: number;
  action: number;
}

const INITIAL_TASKS: Task[] = [
  {
    id: '1',
    wbs: '1',
    name: '專案啟動',
    start: startOfDay(new Date()),
    end: addDays(startOfDay(new Date()), 5),
    duration: 5,
    dependencies: [],
    progress: 0,
    color: '#6366f1',
  },
  {
    id: '2',
    parentId: '1',
    wbs: '1.1',
    name: '需求訪談',
    start: addDays(startOfDay(new Date()), 5),
    end: addDays(startOfDay(new Date()), 10),
    duration: 5,
    dependencies: [{ predecessorId: '1', type: 'FS' }],
    progress: 0,
    color: '#8b5cf6',
  },
  {
    id: '3',
    parentId: '2',
    wbs: '1.1.1',
    name: '系統設計',
    start: addDays(startOfDay(new Date()), 10),
    end: addDays(startOfDay(new Date()), 17),
    duration: 7,
    dependencies: [{ predecessorId: '2', type: 'FS' }],
    progress: 0,
    color: '#ec4899',
  },
  {
    id: '4',
    wbs: '2',
    name: '程式開發',
    start: addDays(startOfDay(new Date()), 17),
    end: addDays(startOfDay(new Date()), 31),
    duration: 14,
    dependencies: [{ predecessorId: '3', type: 'FS' }],
    progress: 0,
    color: '#10b981',
  },
];

const INITIAL_COLUMN_WIDTHS: ColumnWidths = {
  wbs: 60,
  name: 200,
  start: 100,
  end: 100,
  duration: 60,
  action: 80,
};

function serializeTasks(tasks: Task[]): any[] {
  return tasks.map((task) => ({
    ...task,
    start: formatISO(task.start, { representation: 'date' }),
    end: formatISO(task.end, { representation: 'date' }),
  }));
}

function deserializeTasks(data: any[]): Task[] {
  return data.map((task: any) => ({
    ...task,
    start: parseISO(task.start),
    end: parseISO(task.end),
    dependencies: Array.isArray(task.dependencies)
      ? task.dependencies.map((d: any) =>
          typeof d === 'string' ? { predecessorId: d, type: 'FS' as const } : d
        )
      : [],
  }));
}

export const StorageManager = {
  saveTasks: async (tasks: Task[]): Promise<void> => {
    try {
      await fetch('/api/db/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serializeTasks(tasks)),
      });
    } catch (error) {
      console.error('Failed to save tasks to D1:', error);
    }
  },

  loadTasks: async (): Promise<Task[]> => {
    try {
      const res = await fetch('/api/db/tasks');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return INITIAL_TASKS;
      return deserializeTasks(data);
    } catch (error) {
      console.error('Failed to load tasks from D1:', error);
      return INITIAL_TASKS;
    }
  },

  saveColumnWidths: async (widths: ColumnWidths): Promise<void> => {
    try {
      await fetch('/api/db/column-widths', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(widths),
      });
    } catch (error) {
      console.error('Failed to save column widths to D1:', error);
    }
  },

  loadColumnWidths: async (): Promise<ColumnWidths> => {
    try {
      const res = await fetch('/api/db/column-widths');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      console.error('Failed to load column widths from D1:', error);
      return INITIAL_COLUMN_WIDTHS;
    }
  },

  clear: async (): Promise<void> => {
    try {
      await fetch('/api/db/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([]),
      });
      await fetch('/api/db/column-widths', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(INITIAL_COLUMN_WIDTHS),
      });
    } catch (error) {
      console.error('Failed to clear D1 data:', error);
    }
  },
};
