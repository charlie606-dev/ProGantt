import { Task, Project } from '../types';
import { startOfDay, addDays, parseISO } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

const PROJECTS_STORAGE_KEY = 'progantt_projects';
const COLUMN_WIDTHS_STORAGE_KEY = 'progantt_column_widths';

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

const getTasksKey = (projectId: string) => `progantt_tasks_${projectId}`;

export const StorageManager = {
  getProjects: (): Project[] => {
    try {
      const data = localStorage.getItem(PROJECTS_STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load projects from localStorage:', error);
      return [];
    }
  },

  saveProjects: (projects: Project[]) => {
    try {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    } catch (error) {
      console.error('Failed to save projects to localStorage:', error);
    }
  },

  createProject: (name: string): Project => {
    const projects = StorageManager.getProjects();
    const newProject: Project = {
      id: uuidv4(),
      name,
      updatedAt: Date.now()
    };
    projects.push(newProject);
    StorageManager.saveProjects(projects);
    
    // Initialize with default tasks
    StorageManager.saveTasks(newProject.id, INITIAL_TASKS);
    
    return newProject;
  },

  deleteProject: (id: string) => {
    const projects = StorageManager.getProjects().filter(p => p.id !== id);
    StorageManager.saveProjects(projects);
    localStorage.removeItem(getTasksKey(id));
  },

  saveTasks: (projectId: string, tasks: Task[]) => {
    try {
      localStorage.setItem(getTasksKey(projectId), JSON.stringify(tasks));
      
      // Update project updatedAt
      const projects = StorageManager.getProjects();
      const project = projects.find(p => p.id === projectId);
      if (project) {
        project.updatedAt = Date.now();
        StorageManager.saveProjects(projects);
      }
    } catch (error) {
      console.error('Failed to save tasks to localStorage:', error);
    }
  },

  loadTasks: (projectId: string): Task[] => {
    try {
      const stored = localStorage.getItem(getTasksKey(projectId));
      if (!stored) return INITIAL_TASKS;

      const parsed = JSON.parse(stored);
      return parsed.map((task: any) => ({
        ...task,
        start: parseISO(task.start),
        end: parseISO(task.end),
        dependencies: Array.isArray(task.dependencies) 
          ? task.dependencies.map((d: any) => 
              typeof d === 'string' ? { predecessorId: d, type: 'FS' } : d
            )
          : [],
      }));
    } catch (error) {
      console.error('Failed to load tasks from localStorage:', error);
      return INITIAL_TASKS;
    }
  },

  saveColumnWidths: (widths: ColumnWidths) => {
    try {
      localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(widths));
    } catch (error) {
      console.error('Failed to save column widths to localStorage:', error);
    }
  },

  loadColumnWidths: (): ColumnWidths => {
    try {
      const stored = localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY);
      if (!stored) return INITIAL_COLUMN_WIDTHS;
      return JSON.parse(stored);
    } catch (error) {
      console.error('Failed to load column widths from localStorage:', error);
      return INITIAL_COLUMN_WIDTHS;
    }
  },
  
  clear: () => {
      localStorage.removeItem(PROJECTS_STORAGE_KEY);
      localStorage.removeItem(COLUMN_WIDTHS_STORAGE_KEY);
  }
};
