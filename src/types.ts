export interface Dependency {
  predecessorId: string;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  linkType?: 'strong' | 'weak';
}

export interface Task {
  id: string;
  wbs: string; // Hierarchy Code (e.g., "1.1")
  name: string;
  start: Date;
  end: Date;
  duration: number; // In days
  dependencies: Dependency[]; // Array of Dependencies
  parentId?: string; // ID of the parent task
  progress: number; // 0-100
  color?: string;
  order?: number; // Sorting order
}

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export type TimelineViewMode = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface Project {
  id: string;
  name: string;
  description?: string;
  manager?: string;
  teamMembers?: string;
  expectedEndDate?: number;
  updatedAt: number;
}
