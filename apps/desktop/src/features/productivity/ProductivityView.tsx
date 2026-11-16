import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProductivityStore } from '../../stores/productivityStore';
import { Card } from '../../components/ui/Card';
import type { TaskItem } from '../../types/productivity';

export function ProductivityView() {
  const {
    tasks,
    projects,
    briefing,
    isLoading,
    fetchTasks,
    fetchProjects,
    fetchBriefing,
    createTask,
    toggleTaskComplete,
    deleteTask,
    createProject,
    deleteProject,
  } = useProductivityStore();

  const [activeTab, setActiveTab] = useState<'tasks' | 'projects'>('tasks');
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskItem['priority']>('medium');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectPath, setNewProjectPath] = useState('D:\\Nero');

  useEffect(() => {
    void fetchTasks();
    void fetchProjects();
    void fetchBriefing();
  }, [fetchTasks, fetchProjects, fetchBriefing]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const ok = await createTask(
      newTaskTitle.trim(),
      newTaskPriority,
      newTaskDesc.trim() || undefined,
      selectedProjectId || undefined,
    );

    if (ok) {
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskPriority('medium');
      setSelectedProjectId('');
      setShowAddModal(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    const ok = await createProject(
      newProjectName.trim(),
      newProjectDesc.trim() || undefined,
      newProjectPath.trim() || undefined,
    );

    if (ok) {
      setNewProjectName('');
      setNewProjectDesc('');
      setShowAddProjectModal(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (taskFilter === 'pending') return t.status === 'pending' || t.status === 'in_progress';
    if (taskFilter === 'completed') return t.status === 'completed';
    return true;
  });

  const getPriorityBadge = (p: TaskItem['priority']) => {
    switch (p) {
      case 'urgent':
        return 'bg-red-500/15 text-red-400 border-red-500/30';
      case 'high':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'medium':
        return 'bg-nero-cyan/15 text-nero-cyan border-nero-cyan/30';
      default:
        return 'bg-white/5 text-nero-muted border-white/10';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-nero-bg">
      {/* Header */}
      <div className="px-8 py-5 border-b border-nero-border flex items-center justify-between shrink-0 glass">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-nero-text font-mono">
              Productivity & Projects
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-nero-cyan/15 text-nero-cyan border border-nero-cyan/30">
              Phase 6
            </span>
          </div>
          <p className="text-xs text-nero-muted mt-0.5">
            Daily briefings, actionable tasks, deadlines, and active workspace projects
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'tasks'
                ? 'bg-nero-cyan text-nero-bg font-semibold'
                : 'text-nero-muted hover:text-nero-text'
            }`}
          >
            Tasks ({tasks.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('projects')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'projects'
                ? 'bg-nero-cyan text-nero-bg font-semibold'
                : 'text-nero-muted hover:text-nero-text'
            }`}
          >
            Projects ({projects.length})
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8 max-w-5xl w-full mx-auto flex flex-col gap-6">
        {/* Daily Briefing Card */}
        {briefing && (
          <Card className="flex flex-col gap-3 relative overflow-hidden bg-gradient-to-r from-nero-cyan/5 via-transparent to-purple-500/5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono uppercase text-nero-cyan tracking-wider">
                  Daily Briefing
                </span>
                <h2 className="text-lg font-semibold text-nero-text mt-0.5">
                  {briefing.greeting}, {briefing.formatted_date}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                  <span className="text-xs text-nero-muted">Pending Tasks</span>
                  <span className="text-base font-bold font-mono text-nero-cyan">
                    {briefing.pending_tasks_count}
                  </span>
                </div>
                {briefing.urgent_tasks_count > 0 && (
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-red-400">Urgent</span>
                    <span className="text-base font-bold font-mono text-red-400">
                      {briefing.urgent_tasks_count}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {briefing.top_tasks.length > 0 && (
              <div className="pt-2 border-t border-white/5 flex flex-wrap gap-2">
                <span className="text-xs text-nero-muted mr-1 font-mono">Top Priorities:</span>
                {briefing.top_tasks.map((t) => (
                  <span
                    key={t.id}
                    className="px-2 py-0.5 rounded text-[11px] font-mono bg-white/5 text-nero-text border border-white/10"
                  >
                    [{t.priority.toUpperCase()}] {t.title}
                  </span>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Tab 1: Tasks */}
        {activeTab === 'tasks' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              {/* Filter Tabs */}
              <div className="flex items-center gap-2">
                {(['pending', 'completed', 'all'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setTaskFilter(filter)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                      taskFilter === filter
                        ? 'bg-nero-cyan/20 text-nero-cyan border border-nero-cyan/40'
                        : 'text-nero-muted hover:text-nero-text bg-white/5'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {/* Add Task Button */}
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="px-3.5 py-1.5 rounded-lg bg-nero-cyan text-nero-bg font-semibold text-xs hover:bg-nero-cyan/90 transition-colors flex items-center gap-1.5"
              >
                <span>+</span> Add Task
              </button>
            </div>

            {/* Tasks List */}
            {isLoading ? (
              <div className="py-12 text-center text-xs text-nero-muted font-mono">
                Loading tasks...
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="py-12 text-center text-xs text-nero-muted font-mono border border-dashed border-white/10 rounded-2xl">
                No {taskFilter} tasks found. Keep up the great work!
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {filteredTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                      task.status === 'completed'
                        ? 'bg-white/2 border-white/5 opacity-60'
                        : 'glass border-white/10 hover:border-nero-cyan/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={task.status === 'completed'}
                        onChange={() => void toggleTaskComplete(task.id, task.status)}
                        className="w-4 h-4 rounded accent-nero-cyan cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-medium ${
                              task.status === 'completed'
                                ? 'line-through text-nero-muted'
                                : 'text-nero-text'
                            }`}
                          >
                            {task.title}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono border uppercase ${getPriorityBadge(
                              task.priority,
                            )}`}
                          >
                            {task.priority}
                          </span>
                        </div>
                        {task.description && (
                          <p className="text-xs text-nero-muted mt-0.5">{task.description}</p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void deleteTask(task.id)}
                      className="text-xs text-nero-muted hover:text-red-400 p-1 transition-colors"
                      title="Delete task"
                    >
                      ✕
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Projects */}
        {activeTab === 'projects' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-nero-muted uppercase">
                Active Workspaces & Code Repositories
              </span>
              <button
                type="button"
                onClick={() => setShowAddProjectModal(true)}
                className="px-3.5 py-1.5 rounded-lg bg-nero-cyan text-nero-bg font-semibold text-xs hover:bg-nero-cyan/90 transition-colors flex items-center gap-1.5"
              >
                <span>+</span> Add Project
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="py-12 text-center text-xs text-nero-muted font-mono border border-dashed border-white/10 rounded-2xl">
                No projects linked yet. Add a workspace repository to start.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.map((proj) => (
                  <Card key={proj.id} className="flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-nero-text font-mono">
                          {proj.name}
                        </h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase">
                          {proj.status}
                        </span>
                      </div>
                      {proj.description && (
                        <p className="text-xs text-nero-muted mt-1">{proj.description}</p>
                      )}
                      {proj.root_path && (
                        <p className="text-[11px] font-mono text-nero-cyan mt-2 truncate">
                          📁 {proj.root_path}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end pt-2 border-t border-white/5">
                      <button
                        type="button"
                        onClick={() => void deleteProject(proj.id)}
                        className="text-xs text-nero-muted hover:text-red-400 transition-colors font-mono"
                      >
                        Delete Project
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Task Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0e0e17] border border-white/10 rounded-2xl p-6 max-w-md w-full flex flex-col gap-4 shadow-2xl"
            >
              <h3 className="text-sm font-semibold text-nero-text font-mono">Add New Task</h3>
              <form onSubmit={handleCreateTask} className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] font-mono text-nero-muted block mb-1">
                    TASK TITLE
                  </label>
                  <input
                    type="text"
                    required
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="What needs to be done?"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-nero-text focus:outline-none focus:border-nero-cyan"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono text-nero-muted block mb-1">
                    DESCRIPTION (OPTIONAL)
                  </label>
                  <textarea
                    rows={2}
                    value={newTaskDesc}
                    onChange={(e) => setNewTaskDesc(e.target.value)}
                    placeholder="Details or notes..."
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-nero-text focus:outline-none focus:border-nero-cyan"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-mono text-nero-muted block mb-1">
                      PRIORITY
                    </label>
                    <select
                      value={newTaskPriority}
                      onChange={(e) =>
                        setNewTaskPriority(e.target.value as TaskItem['priority'])
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-nero-text font-mono focus:outline-none focus:border-nero-cyan"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-nero-muted block mb-1">
                      LINK PROJECT
                    </label>
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-nero-text font-mono focus:outline-none focus:border-nero-cyan"
                    >
                      <option value="">None</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-nero-muted hover:text-nero-text transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-nero-cyan text-nero-bg font-semibold text-xs hover:bg-nero-cyan/90 transition-colors"
                  >
                    Save Task
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Project Modal */}
      <AnimatePresence>
        {showAddProjectModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0e0e17] border border-white/10 rounded-2xl p-6 max-w-md w-full flex flex-col gap-4 shadow-2xl"
            >
              <h3 className="text-sm font-semibold text-nero-text font-mono">Link New Project</h3>
              <form onSubmit={handleCreateProject} className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] font-mono text-nero-muted block mb-1">
                    PROJECT NAME
                  </label>
                  <input
                    type="text"
                    required
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g. NERO Desktop Core"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-nero-text focus:outline-none focus:border-nero-cyan"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono text-nero-muted block mb-1">
                    ROOT DIRECTORY PATH
                  </label>
                  <input
                    type="text"
                    value={newProjectPath}
                    onChange={(e) => setNewProjectPath(e.target.value)}
                    placeholder="e.g. D:\Nero"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-nero-text font-mono focus:outline-none focus:border-nero-cyan"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono text-nero-muted block mb-1">
                    DESCRIPTION (OPTIONAL)
                  </label>
                  <textarea
                    rows={2}
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    placeholder="Overview of this project..."
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-nero-text focus:outline-none focus:border-nero-cyan"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddProjectModal(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-nero-muted hover:text-nero-text transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-nero-cyan text-nero-bg font-semibold text-xs hover:bg-nero-cyan/90 transition-colors"
                  >
                    Save Project
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
