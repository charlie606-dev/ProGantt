/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TimelineViewMode, Task } from './types';
import { TaskTable } from './components/TaskTable';
import { GanttChart } from './components/GanttChart';
import { TaskDialog } from './components/TaskDialog';
import { IntegratedGantt } from './components/IntegratedGantt';
import { recalculateSchedule, recalculateWBS } from './utils/scheduler';
import { StorageManager, ColumnWidths } from './utils/storageManager';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Calendar, List, BarChart2, Table2, Undo2, Redo2, Loader2 } from 'lucide-react';
import { addDays, startOfDay } from 'date-fns';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  // History state for Undo/Redo
  const [past, setPast] = useState<Task[][]>([]);
  const [future, setFuture] = useState<Task[][]>([]);

  const [tasks, setTasksState] = useState<Task[]>([]);

  // Custom setTasks that manages history
  const setTasks = useCallback((action: React.SetStateAction<Task[]>) => {
    setTasksState(prev => {
      const next = typeof action === 'function' ? (action as (prevState: Task[]) => Task[])(prev) : action;
      // Only add to history if tasks actually changed
      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        setPast(p => [...p, prev]);
        setFuture([]);
      }
      return next;
    });
  }, []);

  const handleUndo = useCallback(() => {
    setPast(p => {
      if (p.length === 0) return p;
      const previous = p[p.length - 1];
      
      setTasksState(currentTasks => {
        setFuture(f => [currentTasks, ...f]);
        return previous;
      });
      
      return p.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setFuture(f => {
      if (f.length === 0) return f;
      const next = f[0];
      
      setTasksState(currentTasks => {
        setPast(p => [...p, currentTasks]);
        return next;
      });
      
      return f.slice(1);
    });
  }, []);

  // Keyboard shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'list' | 'gantt' | 'integrated'>('list');
  const [timelineViewMode, setTimelineViewMode] = useState<TimelineViewMode>('day');
  
  const [integratedColumnWidths, setIntegratedColumnWidths] = useState<ColumnWidths>({
    wbs: 60, name: 200, start: 100, end: 100, duration: 60, action: 80,
  });
  
  const [initialParentId, setInitialParentId] = useState<string | undefined>(undefined);
  const [insertAfterId, setInsertAfterId] = useState<string | undefined>(undefined);

  const saveTasksTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveWidthsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);

  // Load data from D1 on mount
  useEffect(() => {
    const loadData = async () => {
      const [loadedTasks, loadedWidths] = await Promise.all([
        StorageManager.loadTasks(),
        StorageManager.loadColumnWidths(),
      ]);
      setTasksState(recalculateSchedule(recalculateWBS(loadedTasks)));
      setIntegratedColumnWidths(loadedWidths);
      setIsLoading(false);
      isInitialLoad.current = false;
    };
    loadData();
  }, []);

  // Save tasks to D1 with debounce
  useEffect(() => {
    if (isInitialLoad.current) return;
    if (saveTasksTimer.current) clearTimeout(saveTasksTimer.current);
    saveTasksTimer.current = setTimeout(() => {
      StorageManager.saveTasks(tasks);
    }, 500);
    return () => {
      if (saveTasksTimer.current) clearTimeout(saveTasksTimer.current);
    };
  }, [tasks]);

  // Save column widths to D1 with debounce
  useEffect(() => {
    if (isInitialLoad.current) return;
    if (saveWidthsTimer.current) clearTimeout(saveWidthsTimer.current);
    saveWidthsTimer.current = setTimeout(() => {
      StorageManager.saveColumnWidths(integratedColumnWidths);
    }, 500);
    return () => {
      if (saveWidthsTimer.current) clearTimeout(saveWidthsTimer.current);
    };
  }, [integratedColumnWidths]);

  const handleAddTask = () => {
    setEditingTask(undefined);
    setInitialParentId(undefined);
    setInsertAfterId(undefined);
    setIsDialogOpen(true);
  };

  const handleQuickAdd = (task: Task) => {
    setEditingTask(undefined);
    setInitialParentId(task.parentId);
    setInsertAfterId(task.id);
    setIsDialogOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setInitialParentId(undefined);
    setInsertAfterId(undefined);
    setIsDialogOpen(true);
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => {
      const filtered = prev.filter((t) => t.id !== taskId);
      // Also remove this task from other tasks' dependencies
      // And handle children? For now, children become orphans (roots) or we delete them?
      // Let's keep them as orphans (roots) for safety, or delete them.
      // Standard behavior: delete children or promote them.
      // Let's promote them to root for now by removing parentId.
      const cleaned = filtered.map((t) => ({
        ...t,
        dependencies: t.dependencies.filter((d) => d.predecessorId !== taskId),
        parentId: t.parentId === taskId ? undefined : t.parentId,
      }));
      return recalculateSchedule(recalculateWBS(cleaned));
    });
  };

  const handleSaveTask = (taskData: Partial<Task>) => {
    setTasks((prev) => {
      let newTasks = [...prev];
      
      if (taskData.id) {
        // Update existing
        newTasks = newTasks.map((t) =>
          t.id === taskData.id
            ? { ...t, ...taskData, end: addDays(taskData.start!, taskData.duration!) } as Task
            : t
        );
      } else {
        // Create new
        const newTask: Task = {
          id: uuidv4(),
          wbs: '', // Will be calculated
          name: taskData.name || '新任務',
          parentId: taskData.parentId,
          start: taskData.start || startOfDay(new Date()),
          duration: taskData.duration || 1,
          end: addDays(taskData.start || startOfDay(new Date()), taskData.duration || 1),
          dependencies: taskData.dependencies || [],
          progress: 0,
          color: taskData.color || '#6366f1',
        };
        
        if (insertAfterId) {
          const index = newTasks.findIndex(t => t.id === insertAfterId);
          if (index !== -1) {
            newTasks.splice(index + 1, 0, newTask);
          } else {
            newTasks.push(newTask);
          }
        } else {
          newTasks.push(newTask);
        }
      }

      setInitialParentId(undefined);
      setInsertAfterId(undefined);
      return recalculateSchedule(recalculateWBS(newTasks));
    });
    setIsDialogOpen(false);
  };

  const handleTaskUpdate = (updatedTask: Task) => {
    setTasks((prev) => {
      const newTasks = prev.map((t) => (t.id === updatedTask.id ? updatedTask : t));
      return recalculateSchedule(recalculateWBS(newTasks));
    });
  };

  const handleReorder = (newTasks: Task[]) => {
    setTasks(() => {
      return recalculateSchedule(recalculateWBS(newTasks));
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
          <p className="text-gray-500 font-medium">載入專案資料中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col font-sans text-gray-900 overflow-hidden">
      {/* App Bar */}
      <header className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg shadow-md">
              <Calendar className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">ProGantt 專案排程</h1>
          </div>
          
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="列表檢視"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode('gantt')}
              className={`p-2 rounded-md transition-all ${viewMode === 'gantt' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="甘特圖檢視"
            >
              <BarChart2 size={18} />
            </button>
            <button
              onClick={() => setViewMode('integrated')}
              className={`p-2 rounded-md transition-all ${viewMode === 'integrated' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="整合檢視 (傳統甘特圖)"
            >
              <Table2 size={18} />
            </button>
          </div>

          {(viewMode === 'gantt' || viewMode === 'integrated') && (
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg text-sm">
              <button
                onClick={() => setTimelineViewMode('day')}
                className={`px-3 py-1.5 rounded-md transition-all ${timelineViewMode === 'day' ? 'bg-white shadow-sm text-indigo-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
              >
                日
              </button>
              <button
                onClick={() => setTimelineViewMode('week')}
                className={`px-3 py-1.5 rounded-md transition-all ${timelineViewMode === 'week' ? 'bg-white shadow-sm text-indigo-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
              >
                週
              </button>
              <button
                onClick={() => setTimelineViewMode('month')}
                className={`px-3 py-1.5 rounded-md transition-all ${timelineViewMode === 'month' ? 'bg-white shadow-sm text-indigo-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
              >
                月
              </button>
              <button
                onClick={() => setTimelineViewMode('quarter')}
                className={`px-3 py-1.5 rounded-md transition-all ${timelineViewMode === 'quarter' ? 'bg-white shadow-sm text-indigo-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
              >
                季
              </button>
              <button
                onClick={() => setTimelineViewMode('year')}
                className={`px-3 py-1.5 rounded-md transition-all ${timelineViewMode === 'year' ? 'bg-white shadow-sm text-indigo-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
              >
                年
              </button>
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={handleUndo}
                disabled={past.length === 0}
                className={`p-2 rounded-md transition-all ${past.length === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-white hover:shadow-sm hover:text-indigo-600'}`}
                title="上一步 (Ctrl+Z)"
              >
                <Undo2 size={18} />
              </button>
              <button
                onClick={handleRedo}
                disabled={future.length === 0}
                className={`p-2 rounded-md transition-all ${future.length === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-white hover:shadow-sm hover:text-indigo-600'}`}
                title="下一步 (Ctrl+Y)"
              >
                <Redo2 size={18} />
              </button>
            </div>
            <button
              onClick={handleAddTask}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">新增任務</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden min-h-0">
          
          {/* Task List Panel */}
          {viewMode === 'list' && (
            <div className="flex-1 min-w-0 flex flex-col w-full h-full">
              <TaskTable
                tasks={tasks}
                onEdit={handleEditTask}
                onDelete={handleDeleteTask}
                onAdd={handleAddTask}
              />
            </div>
          )}

          {/* Gantt Chart Panel */}
          {viewMode === 'gantt' && (
            <div className="flex-1 min-w-0 flex flex-col w-full h-full">
              <GanttChart
                tasks={tasks}
                onTaskClick={handleEditTask}
                onTaskUpdate={handleTaskUpdate}
                viewMode={timelineViewMode}
              />
            </div>
          )}

          {/* Integrated View Panel */}
          {viewMode === 'integrated' && (
            <div className="flex-1 min-w-0 flex flex-col w-full h-full">
              <IntegratedGantt
                tasks={tasks}
                onEdit={handleEditTask}
                onDelete={handleDeleteTask}
                onTaskUpdate={handleTaskUpdate}
                onQuickAdd={handleQuickAdd}
                onReorder={handleReorder}
                columnWidths={integratedColumnWidths}
                onColumnWidthChange={setIntegratedColumnWidths}
                viewMode={timelineViewMode}
              />
            </div>
          )}
        </div>
      </main>

      {/* Dialog */}
      <TaskDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSaveTask}
        task={editingTask}
        existingTasks={tasks}
        initialParentId={initialParentId}
      />
    </div>
  );
}

