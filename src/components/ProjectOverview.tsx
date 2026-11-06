import React, { useState, useEffect } from 'react';
import { Project } from '../types';
import { Save, Calendar as CalendarIcon, Users, User, FileText, Briefcase } from 'lucide-react';
import { format } from 'date-fns';

interface ProjectOverviewProps {
  project: Project;
  onUpdateProject: (updatedProject: Project) => void;
}

export const ProjectOverview: React.FC<ProjectOverviewProps> = ({ project, onUpdateProject }) => {
  const [formData, setFormData] = useState<Project>(project);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setFormData(project);
    setIsDirty(false);
  }, [project]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setIsDirty(true);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value ? new Date(e.target.value).getTime() : undefined;
    setFormData(prev => ({ ...prev, expectedEndDate: dateValue }));
    setIsDirty(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProject({ ...formData, updatedAt: Date.now() });
    setIsDirty(false);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-white flex justify-between items-center">
          <div className="flex items-center gap-2 text-primary-600">
            <Briefcase size={24} />
            <h2 className="text-xl font-bold text-gray-800">專案概覽</h2>
          </div>
          {isDirty && (
            <span className="text-sm text-amber-600 font-medium">有未儲存的變更</span>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Project Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <Briefcase size={16} className="text-gray-400" />
              專案名稱 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              placeholder="輸入專案名稱"
            />
          </div>

          {/* Project Manager & Expected End Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="manager" className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                <User size={16} className="text-gray-400" />
                專案經理
              </label>
              <input
                type="text"
                id="manager"
                name="manager"
                value={formData.manager || ''}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                placeholder="輸入專案經理姓名"
              />
            </div>
            
            <div>
              <label htmlFor="expectedEndDate" className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                <CalendarIcon size={16} className="text-gray-400" />
                預計完成日期
              </label>
              <input
                type="date"
                id="expectedEndDate"
                name="expectedEndDate"
                value={formData.expectedEndDate ? format(new Date(formData.expectedEndDate), 'yyyy-MM-dd') : ''}
                onChange={handleDateChange}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              />
            </div>
          </div>

          {/* Team Members */}
          <div>
            <label htmlFor="teamMembers" className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <Users size={16} className="text-gray-400" />
              專案參與人員
            </label>
            <input
              type="text"
              id="teamMembers"
              name="teamMembers"
              value={formData.teamMembers || ''}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              placeholder="例如：王小明, 李大華, 張小美 (以逗號分隔)"
            />
          </div>

          {/* Project Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <FileText size={16} className="text-gray-400" />
              專案內容
            </label>
            <textarea
              id="description"
              name="description"
              rows={5}
              value={formData.description || ''}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors resize-y"
              placeholder="描述專案的目標、範圍與其他重要資訊..."
            />
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              disabled={!isDirty}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
                isDirty 
                  ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm hover:shadow' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Save size={18} />
              儲存變更
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
