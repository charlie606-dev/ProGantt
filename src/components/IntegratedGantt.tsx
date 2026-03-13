import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Task, TimelineViewMode } from '../types';
import { 
  format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, eachQuarterOfInterval, eachYearOfInterval,
  startOfDay, addDays, min, max, isSameDay, differenceInDays, parseISO, isWeekend,
  startOfWeek, startOfMonth, startOfYear, startOfQuarter,
  endOfWeek, endOfMonth, endOfYear, endOfQuarter
} from 'date-fns';
import { motion } from 'motion/react';
import { Edit2, Trash2, Plus, GripVertical } from 'lucide-react';

interface IntegratedGanttProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onTaskUpdate: (task: Task) => void;
  onQuickAdd: (task: Task) => void;
  onReorder?: (tasks: Task[]) => void;
  columnWidths: {
    wbs: number;
    name: number;
    start: number;
    end: number;
    duration: number;
    action: number;
  };
  onColumnWidthChange: (widths: {
    wbs: number;
    name: number;
    start: number;
    end: number;
    duration: number;
    action: number;
  }) => void;
  viewMode?: TimelineViewMode;
}

export const IntegratedGantt: React.FC<IntegratedGanttProps> = ({ tasks, onEdit, onDelete, onTaskUpdate, onQuickAdd, onReorder, columnWidths, onColumnWidthChange, viewMode = 'day' }) => {
  const { days, projectStart, projectEnd } = useMemo(() => {
    if (tasks.length === 0) {
      const today = startOfDay(new Date());
      return { days: [today], projectStart: today, projectEnd: today };
    }

    const startDates = tasks.map((t) => t.start);
    const endDates = tasks.map((t) => t.end);
    
    const minDate = min(startDates);
    const maxDate = max(endDates);
    
    let bufferStart = 2;
    let bufferEnd = 5;
    if (viewMode === 'week') { bufferStart = 7; bufferEnd = 14; }
    if (viewMode === 'month') { bufferStart = 30; bufferEnd = 60; }
    if (viewMode === 'quarter') { bufferStart = 90; bufferEnd = 90; }
    if (viewMode === 'year') { bufferStart = 365; bufferEnd = 365; }
    
    const projectStart = addDays(minDate, -bufferStart);
    const projectEnd = addDays(maxDate, bufferEnd);

    const days = eachDayOfInterval({ start: projectStart, end: projectEnd });
    return { days, projectStart, projectEnd };
  }, [tasks, viewMode]);

  const cellWidth = useMemo(() => {
    switch (viewMode) {
      case 'year': return 0.5;
      case 'quarter': return 1;
      case 'month': return 3;
      case 'week': return 10;
      case 'day':
      default: return 40;
    }
  }, [viewMode]);

  const { topHeader, bottomHeader } = useMemo(() => {
    if (days.length === 0) return { topHeader: [], bottomHeader: [] };

    const getDays = (start: Date, end: Date) => {
      const s = max([start, projectStart]);
      const e = min([end, projectEnd]);
      return Math.max(0, differenceInDays(addDays(e, 1), s));
    };

    switch (viewMode) {
      case 'year': {
        const years = eachYearOfInterval({ start: projectStart, end: projectEnd });
        const bottom = years.map(y => ({
          key: y.toISOString(),
          label: format(y, 'yyyy'),
          date: y,
          daysCount: getDays(startOfYear(y), endOfYear(y))
        }));
        return { topHeader: [], bottomHeader: bottom };
      }
      case 'quarter': {
        const years = eachYearOfInterval({ start: projectStart, end: projectEnd });
        const top = years.map(y => ({
          key: y.toISOString(),
          label: format(y, 'yyyy'),
          daysCount: getDays(startOfYear(y), endOfYear(y))
        }));
        const quarters = eachQuarterOfInterval({ start: projectStart, end: projectEnd });
        const bottom = quarters.map(q => ({
          key: q.toISOString(),
          label: `Q${format(q, 'Q')}`,
          date: q,
          daysCount: getDays(startOfQuarter(q), endOfQuarter(q))
        }));
        return { topHeader: top, bottomHeader: bottom };
      }
      case 'month': {
        const years = eachYearOfInterval({ start: projectStart, end: projectEnd });
        const top = years.map(y => ({
          key: y.toISOString(),
          label: format(y, 'yyyy'),
          daysCount: getDays(startOfYear(y), endOfYear(y))
        }));
        const months = eachMonthOfInterval({ start: projectStart, end: projectEnd });
        const bottom = months.map(m => ({
          key: m.toISOString(),
          label: format(m, 'MMM'),
          date: m,
          daysCount: getDays(startOfMonth(m), endOfMonth(m))
        }));
        return { topHeader: top, bottomHeader: bottom };
      }
      case 'week': {
        const months = eachMonthOfInterval({ start: projectStart, end: projectEnd });
        const top = months.map(m => ({
          key: m.toISOString(),
          label: format(m, 'yyyy MMM'),
          daysCount: getDays(startOfMonth(m), endOfMonth(m))
        }));
        const weeks = eachWeekOfInterval({ start: projectStart, end: projectEnd }, { weekStartsOn: 1 });
        const bottom = weeks.map(w => ({
          key: w.toISOString(),
          label: `Week ${format(w, 'w')}`,
          date: w,
          daysCount: getDays(startOfWeek(w, { weekStartsOn: 1 }), endOfWeek(w, { weekStartsOn: 1 }))
        }));
        return { topHeader: top, bottomHeader: bottom };
      }
      case 'day':
      default: {
        const months = eachMonthOfInterval({ start: projectStart, end: projectEnd });
        const top = months.map(m => ({
          key: m.toISOString(),
          label: format(m, 'yyyy年 MM月'),
          daysCount: getDays(startOfMonth(m), endOfMonth(m))
        }));
        const bottom = days.map(d => ({
          key: d.toISOString(),
          label: format(d, 'd'),
          subLabel: format(d, 'EEE'),
          date: d,
          daysCount: 1,
          isWeekend: isWeekend(d),
          isToday: isSameDay(d, new Date())
        }));
        return { topHeader: top, bottomHeader: bottom };
      }
    }
  }, [viewMode, projectStart, projectEnd, days]);

  const totalLeftWidth = Object.values(columnWidths).reduce<number>((a, b) => a + (b as number), 0) + 30; // +30 for drag handle

  // Refs for scroll syncing
  const leftBodyRef = useRef<HTMLDivElement>(null);
  const rightHeaderRef = useRef<HTMLDivElement>(null);
  const rightBodyRef = useRef<HTMLDivElement>(null);
  
  const isSyncingLeft = useRef(false);
  const isSyncingRight = useRef(false);

  // Resizing logic for columns
  const resizingRef = useRef<{ column: keyof typeof columnWidths; startX: number; startWidth: number } | null>(null);

  // Drag logic for tasks
  interface DragState {
    taskId: string;
    type: 'move' | 'resize-left' | 'resize-right';
    startX: number;
    originalStart: Date;
    originalEnd: Date;
    originalDuration: number;
    currentStart: Date;
    currentEnd: Date;
    currentDuration: number;
  }

  const [dragState, setDragState] = useState<DragState | null>(null);
  const hasDraggedRef = useRef(false);

  // Dependency drag logic
  interface DependencyDragState {
    sourceTaskId: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  }
  const [dependencyDrag, setDependencyDrag] = useState<DependencyDragState | null>(null);

  // Panning state
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; scrollLeft: number } | null>(null);

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ taskId: string; field: keyof Task } | null>(null);
  const [tempValue, setTempValue] = useState<string | number>('');

  // Column resizing effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const { column, startX, startWidth } = resizingRef.current;
      const diff = e.clientX - startX;
      onColumnWidthChange({
        ...columnWidths,
        [column]: Math.max(startWidth + diff, 40), // Minimum width 40px
      });
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [columnWidths, onColumnWidthChange]);

  // Panning effect
  useEffect(() => {
    if (!isPanning) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (panStartRef.current && rightBodyRef.current) {
        e.preventDefault();
        const dx = e.clientX - panStartRef.current.x;
        rightBodyRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
      }
    };

    const handleMouseUp = () => {
      setIsPanning(false);
      panStartRef.current = null;
      document.body.style.cursor = 'default';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'grabbing';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [isPanning]);

  const handlePanMouseDown = (e: React.MouseEvent) => {
    // Only allow left click
    if (e.button !== 0) return;
    
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      scrollLeft: rightBodyRef.current?.scrollLeft || 0
    };
  };

  // Task dragging effect
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.startX;
      const deltaDays = Math.round(deltaX / cellWidth);

      // Only mark as dragged if there's actual movement or intention to drag
      // But since we are in mousemove, it means mouse moved.
      hasDraggedRef.current = true;

      if (dragState.type === 'move') {
        const newStart = addDays(dragState.originalStart, deltaDays);
        const newEnd = addDays(newStart, dragState.originalDuration);
        
        setDragState((prev) => prev ? {
          ...prev,
          currentStart: newStart,
          currentEnd: newEnd,
          currentDuration: dragState.originalDuration
        } : null);
      } else if (dragState.type === 'resize-left') {
        let newDuration = dragState.originalDuration - deltaDays;
        if (newDuration < 1) newDuration = 1;
        
        const newStart = addDays(dragState.originalEnd, -newDuration);
        
        setDragState((prev) => prev ? {
          ...prev,
          currentStart: newStart,
          currentDuration: newDuration
        } : null);
      } else if (dragState.type === 'resize-right') {
        let newDuration = dragState.originalDuration + deltaDays;
        if (newDuration < 1) newDuration = 1;
        
        const newEnd = addDays(dragState.originalStart, newDuration);
        
        setDragState((prev) => prev ? {
          ...prev,
          currentEnd: newEnd,
          currentDuration: newDuration
        } : null);
      }
    };

    const handleMouseUp = () => {
      if (dragState) {
        const task = tasks.find(t => t.id === dragState.taskId);
        if (task) {
          if (
            task.start.getTime() !== dragState.currentStart.getTime() ||
            task.duration !== dragState.currentDuration
          ) {
            onTaskUpdate({
              ...task,
              start: dragState.currentStart,
              end: addDays(dragState.currentStart, dragState.currentDuration),
              duration: dragState.currentDuration
            });
          }
        }
        setDragState(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, tasks, onTaskUpdate, cellWidth]);

  // Dependency drag effect
  useEffect(() => {
    if (!dependencyDrag) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!rightBodyRef.current) return;
      const rect = rightBodyRef.current.getBoundingClientRect();
      setDependencyDrag(prev => prev ? {
        ...prev,
        currentX: e.clientX - rect.left + rightBodyRef.current!.scrollLeft,
        currentY: e.clientY - rect.top + rightBodyRef.current!.scrollTop
      } : null);
    };

    const handleMouseUp = () => {
      setTimeout(() => setDependencyDrag(null), 0);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dependencyDrag]);

  const handleDependencyMouseDown = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    e.preventDefault();
    if (!rightBodyRef.current) return;
    
    const rect = rightBodyRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left + rightBodyRef.current.scrollLeft;
    const startY = e.clientY - rect.top + rightBodyRef.current.scrollTop;

    setDependencyDrag({
      sourceTaskId: task.id,
      startX,
      startY,
      currentX: startX,
      currentY: startY
    });
  };

  const handleDependencyDrop = (targetTask: Task) => {
    if (!dependencyDrag) return;
    if (dependencyDrag.sourceTaskId === targetTask.id) return;

    const checkCircular = (taskId: string, targetId: string): boolean => {
      if (taskId === targetId) return true;
      const task = tasks.find(t => t.id === taskId);
      if (!task || !task.dependencies) return false;
      return task.dependencies.some(dep => checkCircular(dep.predecessorId, targetId));
    };

    if (checkCircular(dependencyDrag.sourceTaskId, targetTask.id)) {
      alert('Cannot create circular dependency');
      return;
    }

    const exists = targetTask.dependencies?.some(d => d.predecessorId === dependencyDrag.sourceTaskId);
    if (!exists) {
      onTaskUpdate({
        ...targetTask,
        dependencies: [...(targetTask.dependencies || []), { predecessorId: dependencyDrag.sourceTaskId, type: 'FS' }]
      });
    }
    setDependencyDrag(null);
  };

  const handleTaskMouseDown = (e: React.MouseEvent, task: Task, type: 'move' | 'resize-left' | 'resize-right') => {
    e.stopPropagation();
    e.preventDefault();
    hasDraggedRef.current = false;
    
    setDragState({
      taskId: task.id,
      type,
      startX: e.clientX,
      originalStart: task.start,
      originalEnd: task.end,
      originalDuration: task.duration,
      currentStart: task.start,
      currentEnd: task.end,
      currentDuration: task.duration
    });
  };

  const startResize = (e: React.MouseEvent, column: keyof typeof columnWidths) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = {
      column,
      startX: e.clientX,
      startWidth: columnWidths[column],
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleLeftScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingLeft.current) return;
    isSyncingRight.current = true;
    if (rightBodyRef.current) {
      rightBodyRef.current.scrollTop = e.currentTarget.scrollTop;
    }
    requestAnimationFrame(() => {
      isSyncingRight.current = false;
    });
  };

  const handleRightScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (rightHeaderRef.current) {
      rightHeaderRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }

    if (isSyncingRight.current) return;
    isSyncingLeft.current = true;
    if (leftBodyRef.current) {
      leftBodyRef.current.scrollTop = e.currentTarget.scrollTop;
    }
    requestAnimationFrame(() => {
      isSyncingLeft.current = false;
    });
  };

  const handleCellClick = (task: Task, field: keyof Task, value: string | number) => {
    const isParent = tasks.some(t => t.parentId === task.id);
    if (isParent && (field === 'start' || field === 'end' || field === 'duration')) {
      return; // Disable editing dates/duration for parent tasks
    }
    setEditingCell({ taskId: task.id, field });
    setTempValue(value);
  };

  const handleCellBlur = () => {
    if (editingCell) {
      saveEdit();
    }
  };

  // Row Reordering
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetTask: Task) => {
    e.preventDefault();
    // Only allow drop if same parent
    const draggedTaskId = e.dataTransfer.getData('text/plain'); // Note: getData not always available in dragover
    // We can't easily check parentId here without storing dragged task in state, 
    // but we can just allow dragover and check on drop.
    // Visual feedback might be misleading if we don't check, but it's simpler.
    setDragOverTaskId(targetTask.id);
  };

  const handleDragLeave = () => {
    setDragOverTaskId(null);
  };

  const handleDrop = (e: React.DragEvent, targetTask: Task) => {
    e.preventDefault();
    setDragOverTaskId(null);
    const draggedTaskId = e.dataTransfer.getData('text/plain');
    
    if (draggedTaskId === targetTask.id) return;

    const draggedTask = tasks.find(t => t.id === draggedTaskId);
    if (!draggedTask) return;

    // Constraint: Same Parent ID
    if (draggedTask.parentId !== targetTask.parentId) {
      return;
    }

    const fromIndex = tasks.findIndex(t => t.id === draggedTaskId);
    const toIndex = tasks.findIndex(t => t.id === targetTask.id);

    if (fromIndex === -1 || toIndex === -1) return;

    const newTasks = [...tasks];
    const [moved] = newTasks.splice(fromIndex, 1);
    newTasks.splice(toIndex, 0, moved);

    onReorder?.(newTasks);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const saveEdit = () => {
    if (!editingCell) return;
    
    const task = tasks.find((t) => t.id === editingCell.taskId);
    if (!task) return;

    let updatedTask = { ...task };

    if (editingCell.field === 'name') {
      if (!String(tempValue).trim()) return; // Don't allow empty names
      updatedTask.name = String(tempValue);
    } else if (editingCell.field === 'start') {
      const newStart = parseISO(String(tempValue));
      if (isNaN(newStart.getTime())) return;
      updatedTask.start = newStart;
      updatedTask.end = addDays(newStart, updatedTask.duration);
    } else if (editingCell.field === 'end') {
      // If end date changes, update duration
      const newEnd = parseISO(String(tempValue));
      if (isNaN(newEnd.getTime())) return;
      
      const newDuration = differenceInDays(newEnd, task.start);
      if (newDuration > 0) {
        updatedTask.duration = newDuration;
        updatedTask.end = newEnd;
      } else {
        // Invalid duration, maybe reset or alert? For now just ignore
        return;
      }
    } else if (editingCell.field === 'duration') {
      const newDuration = Number(tempValue);
      if (isNaN(newDuration) || newDuration < 1) return;
      updatedTask.duration = newDuration;
      updatedTask.end = addDays(updatedTask.start, newDuration);
    }

    onTaskUpdate(updatedTask);
    setEditingCell(null);
  };

  const Resizer = ({ column }: { column: keyof typeof columnWidths }) => (
    <div
      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 z-50 transition-colors"
      onMouseDown={(e) => startResize(e, column)}
    />
  );

  const renderCell = (task: Task, field: keyof Task, width: number, type: 'text' | 'date' | 'number' = 'text') => {
    const isEditing = editingCell?.taskId === task.id && editingCell?.field === field;
    const isParent = tasks.some(t => t.parentId === task.id);
    
    let displayValue: string | number = '';
    if (field === 'name') displayValue = task.name;
    else if (field === 'start') displayValue = format(task.start, 'yyyy-MM-dd');
    else if (field === 'end') displayValue = format(task.end, 'yyyy-MM-dd');
    else if (field === 'duration') displayValue = task.duration;

    return (
      <div 
        className="flex items-center px-4 text-sm border-r border-gray-100 truncate cursor-pointer hover:bg-gray-100" 
        style={{ width }}
        onClick={() => handleCellClick(task, field, displayValue)}
      >
        {isEditing ? (
          <input
            autoFocus
            type={type}
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={handleCellBlur}
            onKeyDown={handleKeyDown}
            className="w-full h-full bg-white border border-indigo-500 rounded px-1 outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          field === 'name' ? (
             <div className="flex items-center w-full">
                <div className="w-2 h-2 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: isParent ? '#374151' : (task.color || '#6366f1') }} />
                <span className="truncate">{task.name}</span>
             </div>
          ) : (
            field === 'start' || field === 'end' ? format(task[field] as Date, 'MM/dd') : task[field as keyof Task]
          )
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-800">整合甘特圖</h2>
      </div>
      
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left Panel: Task List */}
        <div className="flex flex-col border-r border-gray-200 flex-shrink-0" style={{ width: totalLeftWidth }}>
          {/* Left Header */}
          <div className="flex bg-gray-50 border-b border-gray-200 h-16 flex-shrink-0">
            <div className="flex items-center justify-center border-r border-gray-200 bg-gray-50" style={{ width: 30 }}>
            </div>
            <div className="relative flex items-center px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200" style={{ width: columnWidths.wbs }}>
              WBS
              <Resizer column="wbs" />
            </div>
            <div className="relative flex items-center px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200" style={{ width: columnWidths.name }}>
              任務名稱
              <Resizer column="name" />
            </div>
            <div className="relative flex items-center px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200" style={{ width: columnWidths.start }}>
              開始日
              <Resizer column="start" />
            </div>
            <div className="relative flex items-center px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200" style={{ width: columnWidths.end }}>
              完成日
              <Resizer column="end" />
            </div>
            <div className="relative flex items-center px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200" style={{ width: columnWidths.duration }}>
              天數
              <Resizer column="duration" />
            </div>
            <div className="relative flex items-center px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200" style={{ width: columnWidths.action }}>
              操作
              <Resizer column="action" />
            </div>
          </div>

          {/* Left Body */}
          <div 
            ref={leftBodyRef}
            onScroll={handleLeftScroll}
            className="flex-1 overflow-y-auto overflow-x-hidden min-h-0"
          >
            {tasks.map((task) => (
              <div 
                key={task.id} 
                className={`flex border-b border-gray-100 hover:bg-gray-50 transition-colors h-12 bg-white ${
                  dragOverTaskId === task.id ? 'border-t-2 border-t-indigo-500' : ''
                }`}
                draggable
                onDragStart={(e) => handleDragStart(e, task)}
                onDragOver={(e) => handleDragOver(e, task)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, task)}
              >
                <div className="flex items-center justify-center border-r border-gray-100 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600" style={{ width: 30 }}>
                  <GripVertical size={14} />
                </div>
                <div className="flex items-center px-4 text-sm font-mono text-gray-600 border-r border-gray-100 truncate" style={{ width: columnWidths.wbs }}>{task.wbs}</div>
                
                {renderCell(task, 'name', columnWidths.name, 'text')}
                {renderCell(task, 'start', columnWidths.start, 'date')}
                {renderCell(task, 'end', columnWidths.end, 'date')}
                {renderCell(task, 'duration', columnWidths.duration, 'number')}

                <div className="flex items-center justify-center px-4 border-r border-gray-100" style={{ width: columnWidths.action }}>
                   <div className="flex gap-1">
                      <button onClick={() => onQuickAdd(task)} className="p-1 text-gray-500 hover:text-green-600 rounded" title="新增後續任務"><Plus size={14} /></button>
                      <button onClick={() => onEdit(task)} className="p-1 text-gray-500 hover:text-indigo-600 rounded"><Edit2 size={14} /></button>
                      <button onClick={() => onDelete(task.id)} className="p-1 text-gray-500 hover:text-red-600 rounded"><Trash2 size={14} /></button>
                   </div>
                </div>
              </div>
            ))}
            {/* Spacer to match Gantt chart height if needed, though usually tasks map 1:1 */}
          </div>
        </div>

        {/* Right Panel: Gantt Chart */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          {/* Right Header (Timeline) */}
          <div 
            ref={rightHeaderRef}
            className="flex flex-col bg-gray-50 border-b border-gray-200 h-16 flex-shrink-0 overflow-hidden"
          >
            {/* Top Row */}
            {topHeader.length > 0 && (
              <div className="flex h-8 border-b border-gray-200 w-max">
                {topHeader.map((m, i) => (
                  <div 
                    key={i} 
                    className="flex-shrink-0 flex items-center justify-center border-r border-gray-200 text-xs font-semibold text-gray-600 relative overflow-hidden"
                    style={{ width: m.daysCount * cellWidth }}
                  >
                    <span className="sticky left-4 whitespace-nowrap">{m.label}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Bottom Row */}
            <div className={`flex w-max ${topHeader.length === 0 ? 'h-16' : 'h-8'}`}>
              {bottomHeader.map((item) => (
                <div
                  key={item.key}
                  className={`flex-shrink-0 flex flex-col items-center justify-center border-r border-gray-200 text-[10px] text-gray-500 ${
                    item.isToday 
                      ? 'bg-blue-50 text-blue-600 font-bold' 
                      : item.isWeekend 
                        ? 'bg-gray-100/80 text-gray-600' 
                        : ''
                  }`}
                  style={{ width: item.daysCount * cellWidth }}
                >
                  <span className="text-xs leading-none">{item.label}</span>
                  {item.subLabel && <span className="uppercase text-[9px] leading-tight">{item.subLabel}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Right Body */}
          <div 
            ref={rightBodyRef}
            onScroll={handleRightScroll}
            onMouseDown={handlePanMouseDown}
            className={`flex-1 overflow-auto relative min-h-0 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
          >
            <div className="relative" style={{ width: days.length * cellWidth }}>
              {/* Grid Lines */}
              <div className="absolute top-0 bottom-0 left-0 right-0 flex z-0 h-full">
                 {bottomHeader.map((item) => (
                    <div
                      key={`grid-${item.key}`}
                      className={`flex-shrink-0 border-r border-gray-50 h-full ${
                        item.isToday 
                          ? 'bg-blue-50/30' 
                          : item.isWeekend 
                            ? 'bg-gray-50/80' 
                            : ''
                      }`}
                      style={{ width: item.daysCount * cellWidth }}
                    />
                  ))}
              </div>

              {/* Task Bars */}
              <div className="relative z-10">


                {tasks.map((task) => {
                   const isParent = tasks.some(t => t.parentId === task.id);
                   // Determine if this task is being dragged
                   const isDragging = dragState?.taskId === task.id;
                   
                   const currentStart = isDragging ? dragState!.currentStart : task.start;
                   const currentDuration = isDragging ? dragState!.currentDuration : task.duration;
                   
                   const startOffset = differenceInDays(currentStart, projectStart) * cellWidth;
                   const width = currentDuration * cellWidth;
                   const visualWidth = Math.max(width, cellWidth);
                   const isTextOverflowing = visualWidth < (task.name.length * 14 + 24);

                   return (
                    <div 
                      key={task.id} 
                      className="h-12 border-b border-gray-100/50 relative group"
                      onMouseUp={(e) => {
                        if (dependencyDrag && dependencyDrag.sourceTaskId !== task.id) {
                          e.stopPropagation();
                          handleDependencyDrop(task);
                        }
                      }}
                    >
                      <motion.div
                        initial={false}
                        animate={{ x: 0, opacity: 1 }}
                        className={`absolute top-2 h-8 ${
                          isParent 
                            ? 'flex items-start overflow-visible cursor-pointer'
                            : `rounded-md shadow-sm border border-white/20 flex items-center px-2 overflow-visible hover:shadow-md transition-shadow ${isDragging ? 'z-30 ring-2 ring-indigo-300 cursor-grabbing' : 'cursor-pointer'}`
                        }`}
                        style={{
                          left: startOffset,
                          width: visualWidth,
                          backgroundColor: isParent ? 'transparent' : (task.color || '#6366f1'),
                        }}
                        onMouseDown={(e) => {
                          if (!isParent) handleTaskMouseDown(e, task, 'move');
                        }}
                        onClick={() => {
                          if (!isDragging && !hasDraggedRef.current) onEdit(task);
                        }}
                      >
                        {isParent ? (
                          <div className="w-full h-full relative pointer-events-none">
                            <div className="absolute top-1 left-0 right-0 h-2" style={{ backgroundColor: '#374151' }} />
                            <div className="absolute top-1 left-0 w-0 h-0" style={{ borderTop: `16px solid #374151`, borderRight: '12px solid transparent' }} />
                            <div className="absolute top-1 right-0 w-0 h-0" style={{ borderTop: `16px solid #374151`, borderLeft: '12px solid transparent' }} />
                            <span className="absolute left-full ml-2 top-0 text-xs font-bold text-gray-700 whitespace-nowrap select-none">
                              {task.name}
                            </span>
                          </div>
                        ) : (
                          <>
                            {/* Left Resize Handle */}
                            <div 
                              className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize hover:bg-black/10 z-10"
                              onMouseDown={(e) => handleTaskMouseDown(e, task, 'resize-left')}
                            />

                            {isTextOverflowing ? (
                              <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-700 whitespace-nowrap pointer-events-none select-none">
                                {task.name}
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-white whitespace-nowrap overflow-hidden text-ellipsis pointer-events-none select-none flex-1">
                                {task.name}
                              </span>
                            )}

                            {/* Right Resize Handle */}
                            <div 
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize hover:bg-black/10 z-10"
                              onMouseDown={(e) => handleTaskMouseDown(e, task, 'resize-right')}
                            />

                            {/* Dependency Create Handle */}
                            <div
                              className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-indigo-500 border-2 border-white opacity-0 group-hover:opacity-100 cursor-crosshair z-20"
                              onMouseDown={(e) => handleDependencyMouseDown(e, task)}
                            />
                          </>
                        )}
                      </motion.div>
                    </div>
                  );
                })}
                <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-50">
                  {tasks.flatMap(task => 
                    (task.dependencies || []).map(dep => {
                      const predecessor = tasks.find(t => t.id === dep.predecessorId);
                      if (!predecessor) return null;

                      // Calculate coordinates
                      // Current task (Successor)
                      const isDraggingTask = dragState?.taskId === task.id;
                      const taskStart = isDraggingTask ? dragState!.currentStart : task.start;
                      const taskStartOffset = differenceInDays(taskStart, projectStart) * cellWidth;
                      const taskIndex = tasks.findIndex(t => t.id === task.id);
                      // Target the top of the task bar (row height 48px, top-2 is 8px)
                      const taskBarTop = taskIndex * 48 + 8; 

                      // Predecessor task
                      const isDraggingPred = dragState?.taskId === predecessor.id;
                      const predStart = isDraggingPred ? dragState!.currentStart : predecessor.start;
                      const predDuration = isDraggingPred ? dragState!.currentDuration : predecessor.duration;
                      const predEndOffset = differenceInDays(addDays(predStart, predDuration), projectStart) * cellWidth;
                      const predIndex = tasks.findIndex(t => t.id === predecessor.id);
                      const predCenterY = predIndex * 48 + 24;

                      // Draw line from Predecessor End (Center Y) to Successor Start (Top Y)
                      
                      const x1 = predEndOffset;
                      const y1 = predCenterY;
                      const x2 = taskStartOffset + 12; // Point slightly into the task bar
                      const y2 = taskBarTop;

                      // Path logic
                      let path = '';
                      if (x2 > x1) {
                        // Successor is to the right
                        path = `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}`;
                      } else {
                        // Successor is to the left or overlapping
                        const midY = y1 < y2 ? y2 - 10 : y2 + 10; // Go to just above/below target
                        path = `M ${x1} ${y1} L ${x1 + 10} ${y1} L ${x1 + 10} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
                      }

                      return (
                        <path
                          key={`${task.id}-${dep.predecessorId}`}
                          d={path}
                          fill="none"
                          stroke="#6b7280"
                          strokeWidth="2"
                          strokeDasharray={dep.linkType === 'weak' ? '4 4' : 'none'}
                          markerEnd="url(#arrowhead)"
                        />
                      );
                    })
                  )}
                  {dependencyDrag && (
                    <line
                      x1={dependencyDrag.startX}
                      y1={dependencyDrag.startY}
                      x2={dependencyDrag.currentX}
                      y2={dependencyDrag.currentY}
                      stroke="#6366f1"
                      strokeWidth="2"
                      strokeDasharray="4"
                      markerEnd="url(#arrowhead-drag)"
                    />
                  )}
                  <defs>
                    <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                      <polygon points="0 0, 6 2, 0 4" fill="#6b7280" />
                    </marker>
                    <marker id="arrowhead-drag" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                      <polygon points="0 0, 6 2, 0 4" fill="#6366f1" />
                    </marker>
                  </defs>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
