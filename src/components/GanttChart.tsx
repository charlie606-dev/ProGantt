import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Task, TimelineViewMode } from '../types';
import { 
  format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, eachQuarterOfInterval, eachYearOfInterval,
  startOfDay, endOfDay, isSameDay, differenceInDays, addDays, min, max, isWeekend,
  startOfWeek, startOfMonth, startOfYear, startOfQuarter,
  endOfWeek, endOfMonth, endOfYear, endOfQuarter
} from 'date-fns';
import { motion } from 'motion/react';

interface GanttChartProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onTaskUpdate: (task: Task) => void;
  viewMode?: TimelineViewMode;
}

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

export const GanttChart: React.FC<GanttChartProps> = ({ tasks, onTaskClick, onTaskUpdate, viewMode = 'day' }) => {
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

  const rowHeight = 48; // Height of each task row
  const headerHeight = 64; // Height of the header (two rows of 32px)

  const chartWidth = days.length * cellWidth;

  const [dragState, setDragState] = useState<DragState | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // Dependency drag logic
  interface DependencyDragState {
    sourceTaskId: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  }
  const [dependencyDrag, setDependencyDrag] = useState<DependencyDragState | null>(null);

  // Handle global mouse move and up
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.startX;
      const deltaDays = Math.round(deltaX / cellWidth);

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
        // Resizing from left: Start changes, End stays (mostly), Duration changes
        // New Start = Original Start + Delta
        // New Duration = Original Duration - Delta
        // Constraint: Duration >= 1
        
        let newDuration = dragState.originalDuration - deltaDays;
        if (newDuration < 1) newDuration = 1;
        
        const newStart = addDays(dragState.originalEnd, -newDuration);
        
        setDragState((prev) => prev ? {
          ...prev,
          currentStart: newStart,
          currentDuration: newDuration
        } : null);
      } else if (dragState.type === 'resize-right') {
        // Resizing from right: Start stays, Duration changes
        // New Duration = Original Duration + Delta
        
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
        // Apply changes
        const task = tasks.find(t => t.id === dragState.taskId);
        if (task) {
          // Check if changed
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
      if (!chartRef.current) return;
      const rect = chartRef.current.getBoundingClientRect();
      setDependencyDrag(prev => prev ? {
        ...prev,
        currentX: e.clientX - rect.left + chartRef.current!.scrollLeft,
        currentY: e.clientY - rect.top + chartRef.current!.scrollTop
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
    if (!chartRef.current) return;
    
    const rect = chartRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left + chartRef.current.scrollLeft;
    const startY = e.clientY - rect.top + chartRef.current.scrollTop;

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

  const handleMouseDown = (e: React.MouseEvent, task: Task, type: 'move' | 'resize-left' | 'resize-right') => {
    e.stopPropagation();
    // Prevent text selection
    e.preventDefault();
    
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-gray-100 bg-gray-50/50">
        <h2 className="text-lg font-semibold text-gray-800">甘特圖</h2>
      </div>
      
      <div className="overflow-auto flex-1 relative min-h-0" ref={chartRef}>
        {/* Header */}
        <div className="flex flex-col sticky top-0 z-30 bg-white border-b border-gray-200" style={{ height: headerHeight, width: chartWidth, minWidth: '100%' }}>
          {/* Top Row */}
          {topHeader.length > 0 && (
            <div className="flex h-8 border-b border-gray-200 w-max">
              {topHeader.map((m, i) => (
                <div 
                  key={i} 
                  className="flex-shrink-0 flex items-center justify-center border-r border-gray-100 text-xs font-semibold text-gray-600 relative overflow-hidden"
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
                className={`flex-shrink-0 flex flex-col items-center justify-center border-r border-gray-100 text-[10px] text-gray-500 ${
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

        <div style={{ width: chartWidth, minWidth: '100%' }} className="relative">
          {/* Grid Lines */}
          <div className="absolute top-0 left-0 bottom-0 right-0 pointer-events-none flex z-0 h-full">
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

          {/* Tasks */}
          <div className="relative z-10 py-2">
            {tasks.map((task, index) => {
              const isParent = tasks.some(t => t.parentId === task.id);
              // Determine if this task is being dragged
              const isDragging = dragState?.taskId === task.id;
              
              const currentStart = isDragging ? dragState!.currentStart : task.start;
              const currentDuration = isDragging ? dragState!.currentDuration : task.duration;
              
              const startOffset = differenceInDays(currentStart, projectStart) * cellWidth;
              const width = currentDuration * cellWidth;
              
              // Ensure minimum width for visibility
              const visualWidth = Math.max(width, cellWidth);
              const isTextOverflowing = visualWidth < (task.name.length * 14 + 24);

              return (
                <div
                  key={task.id}
                  className="relative flex items-center group"
                  style={{ height: rowHeight }}
                  onMouseUp={(e) => {
                    if (dependencyDrag && dependencyDrag.sourceTaskId !== task.id) {
                      e.stopPropagation();
                      handleDependencyDrop(task);
                    }
                  }}
                >
                  <motion.div
                    initial={false}
                    animate={{ 
                      x: 0,
                      opacity: 1
                    }}
                    className={`absolute h-8 ${
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
                      if (!isParent) handleMouseDown(e, task, 'move');
                    }}
                    onClick={(e) => {
                      if (!isDragging) onTaskClick(task);
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
                          onMouseDown={(e) => handleMouseDown(e, task, 'resize-left')}
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
                          onMouseDown={(e) => handleMouseDown(e, task, 'resize-right')}
                        />

                        {/* Dependency Create Handle */}
                        <div
                          className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-indigo-500 border-2 border-white opacity-0 group-hover:opacity-100 cursor-crosshair z-20"
                          onMouseDown={(e) => handleDependencyMouseDown(e, task)}
                        />
                      </>
                    )}
                  </motion.div>
                  
                  {/* Task Label (if needed outside bar) */}
                  {/* <div
                    className="absolute text-xs text-gray-500 ml-2 whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ left: startOffset + visualWidth }}
                  >
                    {task.duration}d
                  </div> */}
                </div>
              );
            })}
            
            {/* Dependencies SVG */}
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-50">
              {tasks.flatMap(task => 
                (task.dependencies || []).map(dep => {
                  const predecessor = tasks.find(t => t.id === dep.predecessorId);
                  if (!predecessor) return null;

                  const isDraggingTask = dragState?.taskId === task.id;
                  const taskStart = isDraggingTask ? dragState!.currentStart : task.start;
                  const taskStartOffset = differenceInDays(taskStart, projectStart) * cellWidth;
                  const taskIndex = tasks.findIndex(t => t.id === task.id);
                  const taskBarTop = taskIndex * rowHeight + 16; // 16px offset for top-2 (8px) + padding (8px)

                  const isDraggingPred = dragState?.taskId === predecessor.id;
                  const predStart = isDraggingPred ? dragState!.currentStart : predecessor.start;
                  const predDuration = isDraggingPred ? dragState!.currentDuration : predecessor.duration;
                  const predEndOffset = differenceInDays(addDays(predStart, predDuration), projectStart) * cellWidth;
                  const predIndex = tasks.findIndex(t => t.id === predecessor.id);
                  const predCenterY = predIndex * rowHeight + rowHeight / 2;

                  const x1 = predEndOffset;
                  const y1 = predCenterY;
                  const x2 = taskStartOffset + 12;
                  const y2 = taskBarTop;

                  let path = '';
                  if (x2 > x1) {
                    path = `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}`;
                  } else {
                    const midY = y1 < y2 ? y2 - 10 : y2 + 10;
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
  );
};
