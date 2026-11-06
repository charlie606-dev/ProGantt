/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { TimelineViewMode, Task, Project } from './types';
import { TaskTable } from './components/TaskTable';
import { GanttChart } from './components/GanttChart';
import { TaskDialog } from './components/TaskDialog';
import { IntegratedGantt } from './components/IntegratedGantt';
import { ProjectOverview } from './components/ProjectOverview';
import { recalculateSchedule, recalculateWBS, calculateCriticalPath } from './utils/scheduler';
import { StorageManager } from './utils/storageManager';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Calendar, List, BarChart2, Table2, Undo2, Redo2, LogOut, LogIn, Folder, FilePlus, Trash2, Cloud, CloudOff, RefreshCw, AlertTriangle, Briefcase } from 'lucide-react';
import { addDays, startOfDay } from 'date-fns';
import { auth } from './firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { subscribeToTasks, saveTaskToFirestore, saveTasksToFirestore, deleteTaskFromFirestore, subscribeToProjects, saveProjectToFirestore, deleteProjectFromFirestore, fetchTasksFromFirestore, fetchProjectsFromFirestore, syncTasksToFirestore } from './utils/firebaseUtils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isLocalMode, setIsLocalMode] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // History state for Undo/Redo
  const [past, setPast] = useState<Task[][]>([]);
  const [future, setFuture] = useState<Task[][]>([]);

  // Initialize state
  const [tasks, setTasksState] = useState<Task[]>([]);
  const tasksRef = useRef<Task[]>([]);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Fetch projects from Firestore or LocalStorage
  useEffect(() => {
    if (isLocalMode) {
      const localProjs = StorageManager.getProjects();
      if (localProjs.length === 0) {
        const newProj = StorageManager.createProject('我的專案');
        setProjects([newProj]);
        setActiveProjectId(newProj.id);
      } else {
        setProjects(localProjs);
        if (!activeProjectId || !localProjs.find(p => p.id === activeProjectId)) {
          setActiveProjectId(localProjs[0].id);
        }
      }
    } else if (isAuthReady && user && !isLocalMode) {
      fetchProjectsFromFirestore(user.uid).then((fetchedProjects) => {
        setProjects(fetchedProjects);
        if (fetchedProjects.length > 0) {
          if (!activeProjectId || !fetchedProjects.find(p => p.id === activeProjectId)) {
            setActiveProjectId(fetchedProjects[0].id);
          }
        } else {
          // Create a default project if none exists
          const newProj: Project = {
            id: uuidv4(),
            name: '我的專案',
            updatedAt: Date.now()
          };
          saveProjectToFirestore(user.uid, newProj);
          setProjects([newProj]);
          setActiveProjectId(newProj.id);
        }
      }).catch((err) => {
        console.error("Failed to fetch projects:", err);
        setError("無法載入專案資料，請檢查您的權限或網路連線。");
      });
    } else if (isAuthReady && !user && !isLocalMode) {
      setProjects([]);
      setActiveProjectId(null);
    }
  }, [user, isAuthReady, isLocalMode]); // Intentionally omitting activeProjectId to avoid re-triggering on project switch

  // Fetch tasks from Firestore or LocalStorage
  useEffect(() => {
    if (isLocalMode && activeProjectId) {
      const loadedTasks = StorageManager.loadTasks(activeProjectId);
      const newTasks = recalculateSchedule(recalculateWBS(loadedTasks));
      setTasksState(newTasks);
      tasksRef.current = newTasks;
    } else if (isAuthReady && user && !isLocalMode && activeProjectId) {
      fetchTasksFromFirestore(user.uid, activeProjectId).then((fetchedTasks) => {
        const newTasks = recalculateSchedule(recalculateWBS(fetchedTasks));
        setTasksState(newTasks);
        tasksRef.current = newTasks;
        setHasUnsavedChanges(false);
      }).catch((err) => {
        console.error("Failed to fetch tasks:", err);
        setError("無法載入任務資料，請檢查您的權限或網路連線。");
      });
    } else {
      setTasksState([]);
      tasksRef.current = [];
    }
  }, [user, isAuthReady, isLocalMode, activeProjectId]);

  // Custom setTasks that manages history
  const setTasks = useCallback((action: React.SetStateAction<Task[]>) => {
    const prev = tasksRef.current;
    const next = typeof action === 'function' ? (action as (prevState: Task[]) => Task[])(prev) : action;
    
    // Only add to history if tasks actually changed
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      setPast(p => [...p, prev]);
      setFuture([]);
      
      // Save to storage (always save locally as backup)
      if (activeProjectId) {
        StorageManager.saveTasks(activeProjectId, next);
      }
      
      if (!isLocalMode && user) {
        setHasUnsavedChanges(true);
      }
      
      setTasksState(next);
      tasksRef.current = next;
    }
  }, [user, isLocalMode, activeProjectId]);

  const handleUndo = useCallback(() => {
    setPast(p => {
      if (p.length === 0) return p;
      const previous = p[p.length - 1];
      
      const currentTasks = tasksRef.current;
      setFuture(f => [currentTasks, ...f]);
      
      setTasksState(previous);
      tasksRef.current = previous;
      
      // Save to storage
      if (activeProjectId) {
        StorageManager.saveTasks(activeProjectId, previous);
      }
      if (!isLocalMode && user) {
        setHasUnsavedChanges(true);
      }
      
      return p.slice(0, -1);
    });
  }, [isLocalMode, activeProjectId, user]);

  const handleRedo = useCallback(() => {
    setFuture(f => {
      if (f.length === 0) return f;
      const next = f[0];
      
      const currentTasks = tasksRef.current;
      setPast(p => [...p, currentTasks]);
      
      setTasksState(next);
      tasksRef.current = next;
      
      // Save to storage
      if (activeProjectId) {
        StorageManager.saveTasks(activeProjectId, next);
      }
      if (!isLocalMode && user) {
        setHasUnsavedChanges(true);
      }
      
      return f.slice(1);
    });
  }, [isLocalMode, activeProjectId, user]);

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
  const [viewMode, setViewMode] = useState<'overview' | 'list' | 'gantt' | 'integrated'>('overview');
  const [timelineViewMode, setTimelineViewMode] = useState<TimelineViewMode>('day');
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  
  const criticalPathIds = useMemo(() => {
    return showCriticalPath ? calculateCriticalPath(tasks) : new Set<string>();
  }, [tasks, showCriticalPath]);
  
  const [integratedColumnWidths, setIntegratedColumnWidths] = useState(() => 
    StorageManager.loadColumnWidths()
  );
  
  const [initialParentId, setInitialParentId] = useState<string | undefined>(undefined);
  const [insertAfterId, setInsertAfterId] = useState<string | undefined>(undefined);

  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('新專案');
  const [isDeleteProjectDialogOpen, setIsDeleteProjectDialogOpen] = useState(false);

  // Save column widths to storage whenever they change
  useEffect(() => {
    StorageManager.saveColumnWidths(integratedColumnWidths);
  }, [integratedColumnWidths]);

  const handleUpdateProject = async (updatedProject: Project) => {
    if (isLocalMode) {
      const projects = StorageManager.getProjects();
      const updatedProjects = projects.map(p => p.id === updatedProject.id ? updatedProject : p);
      StorageManager.saveProjects(updatedProjects);
      setProjects(updatedProjects);
    } else if (user) {
      try {
        await saveProjectToFirestore(user.uid, updatedProject);
        setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
      } catch (err) {
        console.error("Failed to update project:", err);
        setError("更新專案失敗。");
      }
    }
  };

  const handleDeleteProject = async () => {
    if (!activeProjectId) return;

    if (isLocalMode) {
      StorageManager.deleteProject(activeProjectId);
      const remaining = StorageManager.getProjects();
      if (remaining.length === 0) {
        const newProj = StorageManager.createProject('我的專案');
        setProjects([newProj]);
        setActiveProjectId(newProj.id);
      } else {
        setProjects(remaining);
        setActiveProjectId(remaining[0].id);
      }
    } else if (user) {
      try {
        await deleteProjectFromFirestore(user.uid, activeProjectId);
        const remaining = projects.filter(p => p.id !== activeProjectId);
        if (remaining.length > 0) {
          setActiveProjectId(remaining[0].id);
        } else {
          const newProj: Project = {
            id: uuidv4(),
            name: '我的專案',
            updatedAt: Date.now()
          };
          await saveProjectToFirestore(user.uid, newProj);
          setActiveProjectId(newProj.id);
        }
      } catch (err) {
        console.error("Failed to delete project:", err);
        setError("刪除專案失敗。");
      }
    }
    setIsDeleteProjectDialogOpen(false);
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login failed:", err);
      setError("登入失敗，請稍後再試。");
    }
  };

  const handleLocalLogin = async () => {
    if (user) {
      await signOut(auth);
    }
    setIsLocalMode(true);
    const localProjs = StorageManager.getProjects();
    if (localProjs.length === 0) {
      const newProj = StorageManager.createProject('我的專案');
      setProjects([newProj]);
      setActiveProjectId(newProj.id);
    } else {
      setProjects(localProjs);
      setActiveProjectId(localProjs[0].id);
    }
  };

  const handleLogout = async () => {
    if (isLocalMode) {
      setIsLocalMode(false);
      setActiveProjectId(null);
      setTasksState([]);
      tasksRef.current = [];
      setPast([]);
      setFuture([]);
    } else {
      try {
        await signOut(auth);
        setPast([]);
        setFuture([]);
        setTasksState([]);
        tasksRef.current = [];
      } catch (err) {
        console.error("Logout failed:", err);
      }
    }
  };

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
      const cleaned = filtered.map((t) => ({
        ...t,
        dependencies: t.dependencies.filter((d) => d.predecessorId !== taskId),
        parentId: t.parentId === taskId ? undefined : t.parentId,
      }));
      
      if (user && !isLocalMode && activeProjectId) {
        setHasUnsavedChanges(true);
      }
      
      return recalculateSchedule(recalculateWBS(cleaned));
    });
  };

  const syncToCloud = useCallback(async () => {
    if (!user || isLocalMode || !activeProjectId || !hasUnsavedChanges || isSaving) return;
    
    setIsSaving(true);
    try {
      await syncTasksToFirestore(user.uid, activeProjectId, tasksRef.current);
      setHasUnsavedChanges(false);
      setLastSavedAt(new Date());
    } catch (err) {
      console.error("Failed to sync tasks to cloud:", err);
      setError("儲存至雲端失敗，請稍後再試。");
    } finally {
      setIsSaving(false);
    }
  }, [user, isLocalMode, activeProjectId, hasUnsavedChanges, isSaving]);

  // Auto-save every 5 minutes
  useEffect(() => {
    const intervalId = setInterval(() => {
      syncToCloud();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(intervalId);
  }, [syncToCloud]);

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

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">載入中...</div>
      </div>
    );
  }

  if (!isLocalMode && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Calendar className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">ProGantt 專案管理</h1>
          <p className="text-gray-500 mb-8">請登入以開始管理您的專案與任務，所有資料將安全地儲存於雲端。</p>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
          >
            <LogIn className="w-5 h-5" />
            使用 Google 帳號登入
          </button>
          
          <div className="mt-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">或</span>
            </div>
          </div>

          <button
            onClick={handleLocalLogin}
            className="w-full flex items-center justify-center gap-2 bg-white border-2 border-gray-200 hover:border-primary-600 hover:bg-primary-50 text-gray-700 px-6 py-3 rounded-xl font-medium transition-colors mt-6"
          >
            <Folder className="w-5 h-5" />
            本機使用 (儲存於瀏覽器)
          </button>
          {error && <p className="mt-4 text-red-500 text-sm">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col font-sans text-gray-900 overflow-hidden">
      {error && (
        <div className="bg-red-50 border-b border-red-200 p-4 flex-shrink-0 z-40">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <p className="text-red-700 text-sm">{error}</p>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 text-sm font-medium">
              關閉
            </button>
          </div>
        </div>
      )}
      {/* App Bar */}
      <header className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-600 rounded-lg shadow-md">
              <Calendar className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">ProGantt 專案排程</h1>
            
            <div className="flex items-center gap-2 ml-4 border-l border-gray-200 pl-4">
              <select
                value={activeProjectId || ''}
                onChange={(e) => setActiveProjectId(e.target.value)}
                className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-1.5"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  setNewProjectName('新專案');
                  setIsNewProjectDialogOpen(true);
                }}
                className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                title="新增檔案"
              >
                <FilePlus size={18} />
              </button>
              <button
                onClick={() => setIsDeleteProjectDialogOpen(true)}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="刪除檔案"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {!isLocalMode && user && (
              <div className="flex items-center gap-2 mr-2">
                <span className="text-xs text-gray-500 hidden sm:block">
                  {isSaving ? '儲存中...' : hasUnsavedChanges ? '有未儲存的變更' : '已與雲端同步'}
                </span>
                <button
                  onClick={syncToCloud}
                  disabled={!hasUnsavedChanges || isSaving}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    hasUnsavedChanges
                      ? 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                      : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                  }`}
                  title="儲存至雲端"
                >
                  {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Cloud size={16} />}
                  <span className="hidden sm:block">儲存</span>
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 border-l border-gray-200 pl-4 ml-2">
              {isLocalMode ? (
                <span className="text-sm font-medium text-gray-700 hidden sm:block">本機使用者</span>
              ) : (
                <>
                  <img src={user?.photoURL || ''} alt={user?.displayName || 'User'} className="w-8 h-8 rounded-full border border-gray-200" referrerPolicy="no-referrer" />
                  <span className="text-sm font-medium text-gray-700 hidden sm:block">{user?.displayName}</span>
                </>
              )}
              <button
                onClick={handleLogout}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors ml-1"
                title="登出"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 overflow-hidden flex flex-col min-h-0">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
          {/* Shared Toolbar */}
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center overflow-x-auto">
            <div className="flex items-center gap-4 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-800 w-32 flex-shrink-0">
                {viewMode === 'overview' ? '專案概覽' : viewMode === 'list' ? '任務列表' : viewMode === 'gantt' ? '甘特圖' : '整合甘特圖'}
              </h2>
              
              <div className="flex items-center gap-4 ml-4">
                {/* Undo/Redo */}
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={handleUndo}
                    disabled={past.length === 0}
                    className={`p-2 rounded-md transition-all ${past.length === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-white hover:shadow-sm hover:text-primary-600'}`}
                    title="上一步 (Ctrl+Z)"
                  >
                    <Undo2 size={18} />
                  </button>
                  <button
                    onClick={handleRedo}
                    disabled={future.length === 0}
                    className={`p-2 rounded-md transition-all ${future.length === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-white hover:shadow-sm hover:text-primary-600'}`}
                    title="下一步 (Ctrl+Y)"
                  >
                    <Redo2 size={18} />
                  </button>
                </div>

                {/* View Mode */}
                <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => setViewMode('overview')}
                    className={`p-2 rounded-md transition-all ${viewMode === 'overview' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
                    title="專案概覽"
                  >
                    <Briefcase size={18} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
                    title="列表檢視"
                  >
                    <List size={18} />
                  </button>
                  <button
                    onClick={() => setViewMode('gantt')}
                    className={`p-2 rounded-md transition-all ${viewMode === 'gantt' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
                    title="甘特圖檢視"
                  >
                    <BarChart2 size={18} />
                  </button>
                  <button
                    onClick={() => setViewMode('integrated')}
                    className={`p-2 rounded-md transition-all ${viewMode === 'integrated' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
                    title="整合檢視 (傳統甘特圖)"
                  >
                    <Table2 size={18} />
                  </button>
                </div>

                {/* Timeline Scale */}
                {(viewMode === 'gantt' || viewMode === 'integrated') && (
                  <div className="flex items-center gap-1 bg-gray-200/50 p-1 rounded-lg text-sm">
                    <button
                      onClick={() => setTimelineViewMode('day')}
                      className={`px-3 py-1.5 rounded-md transition-all ${timelineViewMode === 'day' ? 'bg-white shadow-sm text-primary-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      日
                    </button>
                    <button
                      onClick={() => setTimelineViewMode('week')}
                      className={`px-3 py-1.5 rounded-md transition-all ${timelineViewMode === 'week' ? 'bg-white shadow-sm text-primary-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      週
                    </button>
                    <button
                      onClick={() => setTimelineViewMode('month')}
                      className={`px-3 py-1.5 rounded-md transition-all ${timelineViewMode === 'month' ? 'bg-white shadow-sm text-primary-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      月
                    </button>
                    <button
                      onClick={() => setTimelineViewMode('quarter')}
                      className={`px-3 py-1.5 rounded-md transition-all ${timelineViewMode === 'quarter' ? 'bg-white shadow-sm text-primary-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      季
                    </button>
                    <button
                      onClick={() => setTimelineViewMode('year')}
                      className={`px-3 py-1.5 rounded-md transition-all ${timelineViewMode === 'year' ? 'bg-white shadow-sm text-primary-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      年
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4 flex-shrink-0 ml-4">
              {/* Critical Path Toggle */}
              {(viewMode === 'gantt' || viewMode === 'integrated') && (
                <button
                  onClick={() => setShowCriticalPath(!showCriticalPath)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors shadow-sm text-sm font-medium border flex-shrink-0 whitespace-nowrap ${
                    showCriticalPath 
                      ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' 
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                  title="顯示/隱藏要徑"
                >
                  <AlertTriangle size={16} className={showCriticalPath ? 'text-red-500' : 'text-gray-400'} />
                  <span className="hidden sm:inline">顯示要徑</span>
                </button>
              )}
              
              {/* Add Task Button */}
              {viewMode !== 'overview' && (
                <button
                  onClick={handleAddTask}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm text-sm font-medium flex-shrink-0 whitespace-nowrap"
                >
                  <Plus size={16} />
                  新增任務
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
            
            {/* Project Overview Panel */}
            {viewMode === 'overview' && activeProjectId && (
              <ProjectOverview
                project={projects.find(p => p.id === activeProjectId)!}
                onUpdateProject={handleUpdateProject}
              />
            )}

            {/* Task List Panel */}
            {viewMode === 'list' && (
              <div className="flex-1 min-w-0 flex flex-col w-full h-full">
                <TaskTable
                  tasks={tasks}
                  onEdit={handleEditTask}
                  onDelete={handleDeleteTask}
                  onAdd={handleAddTask}
                  onTaskUpdate={handleTaskUpdate}
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
                  showCriticalPath={showCriticalPath}
                  criticalPathIds={criticalPathIds}
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
                  showCriticalPath={showCriticalPath}
                  criticalPathIds={criticalPathIds}
                />
              </div>
            )}
          </div>
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

      {/* New Project Dialog */}
      {isNewProjectDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full">
            <h2 className="text-lg font-bold mb-4">新增檔案</h2>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 mb-4 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newProjectName.trim()) {
                  if (isLocalMode) {
                    const newProj = StorageManager.createProject(newProjectName.trim());
                    setProjects(StorageManager.getProjects());
                    setActiveProjectId(newProj.id);
                  } else if (user) {
                    const newProj: Project = {
                      id: uuidv4(),
                      name: newProjectName.trim(),
                      updatedAt: Date.now()
                    };
                    saveProjectToFirestore(user.uid, newProj).then(() => {
                      setActiveProjectId(newProj.id);
                    }).catch(err => {
                      console.error("Failed to create project:", err);
                      setError("建立專案失敗。");
                    });
                  }
                  setIsNewProjectDialogOpen(false);
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsNewProjectDialogOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (newProjectName.trim()) {
                    if (isLocalMode) {
                      const newProj = StorageManager.createProject(newProjectName.trim());
                      setProjects(StorageManager.getProjects());
                      setActiveProjectId(newProj.id);
                    } else if (user) {
                      const newProj: Project = {
                        id: uuidv4(),
                        name: newProjectName.trim(),
                        updatedAt: Date.now()
                      };
                      saveProjectToFirestore(user.uid, newProj).then(() => {
                        setActiveProjectId(newProj.id);
                      }).catch(err => {
                        console.error("Failed to create project:", err);
                        setError("建立專案失敗。");
                      });
                    }
                    setIsNewProjectDialogOpen(false);
                  }
                }}
                className="px-4 py-2 bg-primary-600 text-white hover:bg-primary-700 rounded-lg transition-colors"
              >
                建立
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Dialog */}
      {isDeleteProjectDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full">
            <h2 className="text-lg font-bold mb-4 text-gray-900">刪除檔案</h2>
            <p className="text-gray-600 mb-6">
              確定要刪除此專案嗎？此操作無法復原，專案內的所有任務將會一併刪除。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsDeleteProjectDialogOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDeleteProject}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

