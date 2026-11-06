import { Task } from '../types';
import { addDays, differenceInDays, isBefore, max, startOfDay } from 'date-fns';

/**
 * Recalculates WBS codes based on parent-child relationships.
 * Returns a flattened list of tasks in hierarchical order.
 */
export function recalculateWBS(tasks: Task[]): Task[] {
  const taskMap = new Map<string, Task[]>();
  const rootTasks: Task[] = [];

  // Group tasks by parentId
  tasks.forEach((task) => {
    if (task.parentId) {
      if (!taskMap.has(task.parentId)) {
        taskMap.set(task.parentId, []);
      }
      taskMap.get(task.parentId)?.push(task);
    } else {
      rootTasks.push(task);
    }
  });

  const result: Task[] = [];

  function traverse(taskList: Task[], prefix: string) {
    taskList.forEach((task, index) => {
      const wbs = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
      const updatedTask = { ...task, wbs };
      result.push(updatedTask);

      const children = taskMap.get(task.id);
      if (children) {
        traverse(children, wbs);
      }
    });
  }

  traverse(rootTasks, '');
  return result;
}

/**
 * Recalculates the schedule based on dependencies.
 * Assumes Finish-to-Start (FS) dependencies for now.
 * If Task B depends on Task A, Task B starts the day after Task A ends.
 */
export function recalculateSchedule(tasks: Task[]): Task[] {
  // Create a map for quick access
  const taskMap = new Map<string, Task>();
  tasks.forEach((t) => taskMap.set(t.id, { ...t }));

  let changed = true;
  let iterations = 0;
  const MAX_ITERATIONS = tasks.length * 2; // Prevent infinite loops

  while (changed && iterations < MAX_ITERATIONS) {
    changed = false;
    iterations++;

    const parentIds = new Set<string>();
    for (const task of taskMap.values()) {
      if (task.parentId) {
        parentIds.add(task.parentId);
      }
    }

    // Iterate through all tasks and update start dates based on dependencies
    for (const task of taskMap.values()) {
      if (parentIds.has(task.id)) {
        continue; // Parent tasks are determined by their children
      }

      if (task.dependencies.length > 0) {
        let maxDependencyStartDate = startOfDay(new Date(0)); // Epoch
        let hasStrongLink = false;

        // Find the latest required start date among all dependencies
        for (const dep of task.dependencies) {
          const depTask = taskMap.get(dep.predecessorId);
          if (depTask) {
            let requiredStart = startOfDay(new Date(0));

            switch (dep.type) {
              case 'FS': // Finish-to-Start: Start >= Predecessor.End
                requiredStart = depTask.end;
                break;
              case 'FF': // Finish-to-Finish: End >= Predecessor.End => Start >= Predecessor.End - Duration
                requiredStart = addDays(depTask.end, -task.duration);
                break;
              case 'SS': // Start-to-Start: Start >= Predecessor.Start
                requiredStart = depTask.start;
                break;
              case 'SF': // Start-to-Finish: End >= Predecessor.Start => Start >= Predecessor.Start - Duration
                requiredStart = addDays(depTask.start, -task.duration);
                break;
              default:
                // Default to FS if unknown
                requiredStart = depTask.end;
            }

            if (isBefore(maxDependencyStartDate, requiredStart)) {
              maxDependencyStartDate = requiredStart;
            }
            
            // Check if this is a strong link
            if (dep.linkType === 'strong' || dep.linkType === undefined) {
               // Default to strong if undefined, or check specific flag
               // Actually, let's assume undefined is 'strong' based on previous default behavior or user request?
               // Wait, previous behavior was "Weak" (push only).
               // But user request implies "Strong" is the new strict mode.
               // Let's treat undefined as 'strong' for now to enforce the new feature visibility, 
               // OR treat as 'weak' to preserve legacy behavior?
               // The TaskDialog defaults new ones to 'strong'. Legacy ones are undefined.
               // Let's treat explicit 'strong' as strong.
               if (dep.linkType === 'strong') {
                 hasStrongLink = true;
               }
            }
          }
        }

        const potentialStart = maxDependencyStartDate;
        
        // If Strong Link: Snap to the calculated start date (even if it pulls back)
        // If Weak Link: Only push forward (preserve manual gaps)
        if (hasStrongLink) {
           if (task.start.getTime() !== potentialStart.getTime()) {
             task.start = potentialStart;
             changed = true;
           }
        } else {
           // Weak Link behavior (Push only)
           if (isBefore(task.start, potentialStart)) {
             task.start = potentialStart;
             changed = true;
           }
        }
      }

      // Always ensure end date is consistent with start + duration
      const consistentEnd = addDays(task.start, task.duration);
      if (task.end.getTime() !== consistentEnd.getTime()) {
        task.end = consistentEnd;
        changed = true;
      }
    }

    // Parent-child logic
    const parentMap = new Map<string, Task[]>();
    for (const task of taskMap.values()) {
      if (task.parentId) {
        if (!parentMap.has(task.parentId)) {
          parentMap.set(task.parentId, []);
        }
        parentMap.get(task.parentId)!.push(task);
      }
    }

    for (const [parentId, children] of parentMap.entries()) {
      const parentTask = taskMap.get(parentId);
      if (parentTask && children.length > 0) {
        let minStart = children[0].start;
        let maxEnd = children[0].end;

        for (let i = 1; i < children.length; i++) {
          if (isBefore(children[i].start, minStart)) {
            minStart = children[i].start;
          }
          if (isBefore(maxEnd, children[i].end)) {
            maxEnd = children[i].end;
          }
        }

        const newDuration = Math.max(1, differenceInDays(maxEnd, minStart));

        if (
          parentTask.start.getTime() !== minStart.getTime() ||
          parentTask.end.getTime() !== maxEnd.getTime() ||
          parentTask.duration !== newDuration
        ) {
          parentTask.start = minStart;
          parentTask.end = maxEnd;
          parentTask.duration = newDuration;
          changed = true;
        }
      }
    }
  }

  return Array.from(taskMap.values());
}

/**
 * Updates a task's duration based on start and end dates.
 */
export function updateTaskDuration(task: Task, newStart: Date, newEnd: Date): Task {
  const duration = differenceInDays(newEnd, newStart);
  return {
    ...task,
    start: newStart,
    end: newEnd,
    duration: Math.max(1, duration), // Minimum 1 day
  };
}

/**
 * Updates a task's end date based on start date and duration.
 */
export function updateTaskEndDate(task: Task, newStart: Date, duration: number): Task {
  return {
    ...task,
    start: newStart,
    duration: duration,
    end: addDays(newStart, duration),
  };
}

/**
 * Calculates the critical path of the project.
 * Returns a Set of task IDs that are on the critical path.
 */
export function calculateCriticalPath(tasks: Task[]): Set<string> {
  const criticalPathIds = new Set<string>();
  if (tasks.length === 0) return criticalPathIds;

  // 1. Identify leaf tasks (tasks without children)
  const parentIds = new Set(tasks.filter(t => t.parentId).map(t => t.parentId));
  const leafTasks = tasks.filter(t => !parentIds.has(t.id));
  
  if (leafTasks.length === 0) return criticalPathIds;

  // 2. Build successors map
  const successors = new Map<string, { id: string, type: string }[]>();
  leafTasks.forEach(t => successors.set(t.id, []));
  
  leafTasks.forEach(t => {
    t.dependencies.forEach(dep => {
      if (successors.has(dep.predecessorId)) {
        successors.get(dep.predecessorId)!.push({ id: t.id, type: dep.type || 'FS' });
      }
    });
  });

  // 3. Initialize LF (Late Finish) and LS (Late Start)
  const maxEF = new Date(Math.max(...leafTasks.map(t => t.end.getTime())));
  const LF = new Map<string, Date>();
  const LS = new Map<string, Date>();
  
  leafTasks.forEach(t => {
    LF.set(t.id, maxEF);
    LS.set(t.id, addDays(maxEF, -t.duration));
  });

  // 4. Backward Pass (Iterative relaxation)
  let changed = true;
  let iterations = 0;
  const MAX_ITERATIONS = leafTasks.length * 2;

  while (changed && iterations < MAX_ITERATIONS) {
    changed = false;
    iterations++;

    for (const task of leafTasks) {
      const currentLF = LF.get(task.id)!;
      let newLF = currentLF;

      const succs = successors.get(task.id) || [];
      for (const succ of succs) {
        const succLS = LS.get(succ.id)!;
        const succLF = LF.get(succ.id)!;
        
        let reqLF = newLF;

        switch (succ.type) {
          case 'FS': reqLF = succLS; break;
          case 'FF': reqLF = succLF; break;
          case 'SS': reqLF = addDays(succLS, task.duration); break;
          case 'SF': reqLF = addDays(succLF, task.duration); break;
          default: reqLF = succLS; break;
        }

        if (isBefore(reqLF, newLF)) {
          newLF = reqLF;
        }
      }

      if (newLF.getTime() !== currentLF.getTime()) {
        LF.set(task.id, newLF);
        LS.set(task.id, addDays(newLF, -task.duration));
        changed = true;
      }
    }
  }

  // 5. Calculate Slack and identify critical leaf tasks
  leafTasks.forEach(task => {
    const ls = LS.get(task.id)!;
    const slack = differenceInDays(ls, task.start);
    
    // If slack is 0 (or less, due to constraints), it's on the critical path
    if (slack <= 0) {
      criticalPathIds.add(task.id);
    }
  });

  // 6. Add parent tasks if they contain critical children
  let parentAdded = true;
  while (parentAdded) {
    parentAdded = false;
    for (const task of tasks) {
      if (task.parentId && criticalPathIds.has(task.id) && !criticalPathIds.has(task.parentId)) {
        criticalPathIds.add(task.parentId);
        parentAdded = true;
      }
    }
  }

  return criticalPathIds;
}
