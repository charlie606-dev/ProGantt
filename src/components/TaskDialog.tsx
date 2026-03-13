import React, { useState, useEffect } from 'react';
import { Task, Dependency, DependencyType } from '../types';
import { format, parseISO, addDays, differenceInDays } from 'date-fns';
import { X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>) => void;
  task?: Task; // If editing, pass the task
  existingTasks: Task[]; // For dependency selection
  initialParentId?: string;
}

export const TaskDialog: React.FC<TaskDialogProps> = ({ isOpen, onClose, onSave, task, existingTasks, initialParentId }) => {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string | undefined>(undefined);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [duration, setDuration] = useState(1);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [color, setColor] = useState('#6366f1');

  useEffect(() => {
    if (task) {
      setName(task.name);
      setParentId(task.parentId);
      setStart(format(task.start, 'yyyy-MM-dd'));
      setEnd(format(task.end, 'yyyy-MM-dd'));
      setDuration(task.duration);
      setDependencies(task.dependencies || []);
      setColor(task.color || '#6366f1');
    } else {
      // Default values for new task
      const today = new Date();
      setName('');
      setParentId(initialParentId);
      setStart(format(today, 'yyyy-MM-dd'));
      setEnd(format(addDays(today, 1), 'yyyy-MM-dd'));
      setDuration(1);
      setDependencies([]);
      setColor('#6366f1');
    }
  }, [task, isOpen, initialParentId]);

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = e.target.value;
    setStart(newStart);
    if (newStart && duration > 0) {
      const newEnd = addDays(parseISO(newStart), duration);
      setEnd(format(newEnd, 'yyyy-MM-dd'));
    }
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = e.target.value;
    setEnd(newEnd);
    if (newEnd && start) {
      const diff = differenceInDays(parseISO(newEnd), parseISO(start));
      if (diff >= 1) {
        setDuration(diff);
      }
    }
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDuration = Number(e.target.value);
    setDuration(newDuration);
    if (newDuration > 0 && start) {
      const newEnd = addDays(parseISO(start), newDuration);
      setEnd(format(newEnd, 'yyyy-MM-dd'));
    }
  };

  const handleSave = () => {
    if (!name || !start || duration < 1) return;

    onSave({
      id: task?.id, // Keep ID if editing
      name,
      parentId,
      start: parseISO(start),
      duration: Number(duration),
      dependencies,
      color,
    });
    onClose();
  };

  const toggleDependency = (id: string) => {
    setDependencies((prev) => {
      const exists = prev.find((d) => d.predecessorId === id);
      if (exists) {
        return prev.filter((d) => d.predecessorId !== id);
      } else {
        return [...prev, { predecessorId: id, type: 'FS', linkType: 'strong' }];
      }
    });
  };

  const updateDependencyType = (id: string, type: DependencyType) => {
    setDependencies((prev) =>
      prev.map((d) => (d.predecessorId === id ? { ...d, type } : d))
    );
  };

  const updateDependencyLinkType = (id: string, linkType: 'strong' | 'weak') => {
    setDependencies((prev) =>
      prev.map((d) => (d.predecessorId === id ? { ...d, linkType } : d))
    );
  };

  const isParent = task ? existingTasks.some(t => t.parentId === task.id) : false;

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">
                {task ? '編輯任務' : '新增任務'}
              </h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Parent Task */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">上層任務 (Parent Task)</label>
                <select
                  value={parentId || ''}
                  onChange={(e) => setParentId(e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                >
                  <option value="">無 (獨立任務)</option>
                  {existingTasks
                    .filter((t) => t.id !== task?.id) // Prevent self-parenting
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.wbs} - {t.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">任務名稱</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="輸入任務名稱"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* Start Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">開始日期</label>
                  <input
                    type="date"
                    value={start}
                    onChange={handleStartChange}
                    disabled={isParent}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all ${isParent ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''}`}
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">結束日期</label>
                  <input
                    type="date"
                    value={end}
                    onChange={handleEndChange}
                    disabled={isParent}
                    min={start ? format(addDays(parseISO(start), 1), 'yyyy-MM-dd') : undefined}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all ${isParent ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''}`}
                  />
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">所需天數</label>
                  <input
                    type="number"
                    min="1"
                    value={duration}
                    onChange={handleDurationChange}
                    disabled={isParent}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all ${isParent ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''}`}
                  />
                </div>
              </div>
              {isParent && (
                <p className="text-xs text-indigo-600 mt-1">此為上層任務，開始日期、結束日期與天數由其子任務自動計算。</p>
              )}

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">顏色</label>
                <div className="flex gap-2">
                  {['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#6b7280'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                        color === c ? 'border-gray-900 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Dependencies */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">前置任務 (依賴關係)</label>
                <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1 bg-gray-50">
                  {existingTasks.filter((t) => t.id !== task?.id).length === 0 ? (
                    <p className="text-xs text-gray-400 p-2">無其他可選任務。</p>
                  ) : (
                    existingTasks
                      .filter((t) => t.id !== task?.id) // Prevent self-dependency
                      .map((t) => {
                        const dependency = dependencies.find((d) => d.predecessorId === t.id);
                        const isSelected = !!dependency;
                        
                        return (
                          <div
                            key={t.id}
                            className={`flex items-center gap-2 p-2 rounded-md transition-colors ${
                              isSelected
                                ? 'bg-indigo-50 border border-indigo-100'
                                : 'hover:bg-gray-100'
                            }`}
                          >
                            <div
                              onClick={() => toggleDependency(t.id)}
                              className={`flex-1 flex items-center justify-between cursor-pointer text-sm ${
                                isSelected ? 'text-indigo-700 font-medium' : 'text-gray-600'
                              }`}
                            >
                              <span className="truncate">{t.wbs} - {t.name}</span>
                              {isSelected && <Check size={14} className="text-indigo-600" />}
                            </div>
                            
                            {isSelected && (
                              <div className="flex gap-1">
                                <select
                                  value={dependency.type}
                                  onChange={(e) => updateDependencyType(t.id, e.target.value as DependencyType)}
                                  className="text-xs border border-gray-300 rounded px-1 py-0.5 outline-none focus:border-indigo-500 bg-white text-gray-700"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <option value="FS">FS (完成-開始)</option>
                                  <option value="FF">FF (完成-完成)</option>
                                  <option value="SS">SS (開始-開始)</option>
                                  <option value="SF">SF (開始-完成)</option>
                                </select>
                                <select
                                  value={dependency.linkType || 'weak'}
                                  onChange={(e) => updateDependencyLinkType(t.id, e.target.value as 'strong' | 'weak')}
                                  className={`text-xs border rounded px-1 py-0.5 outline-none focus:border-indigo-500 bg-white ${
                                    dependency.linkType === 'strong' ? 'text-red-600 border-red-200 bg-red-50' : 'text-gray-600 border-gray-300'
                                  }`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <option value="strong">強連結</option>
                                  <option value="weak">弱連結</option>
                                </select>
                              </div>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">選擇必須在此任務開始前完成的任務。</p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!name || !start || duration < 1}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                儲存任務
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
