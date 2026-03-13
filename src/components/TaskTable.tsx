import React from 'react';
import { Task } from '../types';
import { format } from 'date-fns';
import { Edit2, Trash2, Plus } from 'lucide-react';

interface TaskTableProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onAdd: () => void;
}

export const TaskTable: React.FC<TaskTableProps> = ({ tasks, onEdit, onDelete, onAdd }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <h2 className="text-lg font-semibold text-gray-800">任務列表</h2>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium"
        >
          <Plus size={16} />
          新增任務
        </button>
      </div>
      
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
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: isParent ? '#374151' : (task.color || '#6366f1') }} />
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
                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
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
