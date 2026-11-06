import React, { useState } from 'react';
import { Task } from '../types';
import { format } from 'date-fns';
import { Edit2, Trash2, Plus } from 'lucide-react';

const PRESET_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#6b7280'];

interface TaskTableProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onAdd: () => void;
  onTaskUpdate?: (task: Task) => void;
}

export const TaskTable: React.FC<TaskTableProps> = ({ tasks, onEdit, onDelete, onAdd, onTaskUpdate }) => {
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);

  return (
    <div className="bg-white overflow-hidden flex flex-col h-full">
      <div className="overflow-auto flex-1 min-h-0">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 w-16">WBS</th>
              <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">任務名稱</th>
              <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 w-24">開始日</th>
              <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 w-24">完成日</th>
              <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 w-20 text-center">天數</th>
              <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 w-24">依賴</th>
              <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 w-20 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-400 text-sm">
                  目前沒有任務。點擊「新增任務」開始規劃。
                </td>
              </tr>
            ) : (
              tasks.map((task) => {
                const isParent = tasks.some(t => t.parentId === task.id);
                return (
                <tr key={task.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="p-4 text-sm font-mono text-gray-600">{task.wbs}</td>
                  <td className="p-4 text-sm font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      <div className={`relative flex-shrink-0 ${activeColorPicker === task.id ? 'z-20' : ''}`}>
                        <button
                          type="button"
                          className={`w-3 h-3 rounded-full ${!isParent ? 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-gray-300' : ''}`}
                          style={{ backgroundColor: isParent ? '#374151' : (task.color || '#6366f1') }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isParent && onTaskUpdate) {
                              setActiveColorPicker(activeColorPicker === task.id ? null : task.id);
                            }
                          }}
                          title={!isParent ? "變更顏色" : undefined}
                        />
                        {activeColorPicker === task.id && onTaskUpdate && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setActiveColorPicker(null); }} />
                            <div className="absolute left-0 top-5 z-50 bg-white border border-gray-200 shadow-lg rounded-lg p-2 grid grid-cols-4 gap-2 w-max" onClick={e => e.stopPropagation()}>
                              {PRESET_COLORS.map(c => (
                                <button
                                  key={c}
                                  type="button"
                                  className="w-5 h-5 rounded-full hover:scale-110 transition-transform border border-gray-200"
                                  style={{ backgroundColor: c }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onTaskUpdate({ ...task, color: c });
                                    setActiveColorPicker(null);
                                  }}
                                />
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                      {task.name}
                    </div>
                  </td>
                  <td className="p-4 text-sm text-gray-600 whitespace-nowrap">{format(task.start, 'MMM d')}</td>
                  <td className="p-4 text-sm text-gray-600 whitespace-nowrap">{format(task.end, 'MMM d')}</td>
                  <td className="p-4 text-sm text-gray-600 text-center">{task.duration}</td>
                  <td className="p-4 text-sm text-gray-500 truncate max-w-[100px]">
                    {task.dependencies.length > 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {task.dependencies.length} refs
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onEdit(task)}
                        className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => onDelete(task.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
