import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTaskStore } from '../../stores/taskStore';
import type { TaskStatus } from '../../types/tasks';

export function TasksView() {
  const {
    tasks,
    activeTaskId,
    activeTask,
    selectedReport,
    isLoading,
    error,
    fetchTasks,
    fetchTask,
    createTask,
    pauseTask,
    resumeTask,
    cancelTask,
    steerTask,
    finishEarlyTask,
    retryTask,
    fetchReport,
    deleteTask,
    setActiveTaskId,
    clearReport,
  } = useTaskStore();

  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'completed' | 'paused'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRequest, setNewRequest] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newAgent, setNewAgent] = useState<'general' | 'research'>('research');
  const [steeringText, setSteeringText] = useState('');
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);

  useEffect(() => {
    void fetchTasks();
    const interval = setInterval(() => {
      void fetchTasks();
      if (activeTaskId) {
        void fetchTask(activeTaskId);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchTasks, fetchTask, activeTaskId]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequest.trim()) return;

    const task = await createTask({
      request: newRequest.trim(),
      title: newTitle.trim() || undefined,
      assigned_agent: newAgent,
    });

    if (task) {
      setNewRequest('');
      setNewTitle('');
      setShowCreateModal(false);
      setActiveTaskId(task.id);
    }
  };

  const handleSteer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!steeringText.trim() || !activeTaskId) return;
    await steerTask(activeTaskId, steeringText.trim());
    setSteeringText('');
  };

  const handleCopyReport = () => {
    if (selectedReport?.report_markdown) {
      navigator.clipboard.writeText(selectedReport.report_markdown);
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2000);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'running') return t.status === 'running' || t.status === 'planning' || t.status === 'queued';
    return t.status === statusFilter;
  });

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'running':
      case 'planning':
        return 'text-cyan-400 bg-cyan-950/40 border-cyan-500/40';
      case 'completed':
        return 'text-emerald-400 bg-emerald-950/40 border-emerald-500/40';
      case 'paused':
        return 'text-amber-400 bg-amber-950/40 border-amber-500/40';
      case 'failed':
        return 'text-rose-400 bg-rose-950/40 border-rose-500/40';
      case 'cancelled':
        return 'text-zinc-400 bg-zinc-900 border-zinc-700';
      default:
        return 'text-cyan-200 bg-slate-900 border-slate-700';
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold tracking-wide text-white">Background Tasks & Agents</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
              Autonomous Engine
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Persistent multi-step research pipelines, state checkpointing, and live agent steering.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition flex items-center space-x-2 shadow-lg shadow-cyan-950/40"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>New Background Task</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-lg text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Main Split Layout */}
      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left Column: Task List */}
        <div className="col-span-5 flex flex-col space-y-3 min-h-0">
          {/* Filter Pills */}
          <div className="flex space-x-1.5 p-1 bg-slate-900/60 border border-slate-800 rounded-lg text-xs">
            {(['all', 'running', 'completed', 'paused'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`flex-1 py-1 rounded capitalize font-medium transition ${
                  statusFilter === filter
                    ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Scrollable Task Cards */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm glass rounded-xl border border-dashed border-slate-800">
                No background tasks found in this view.
              </div>
            ) : (
              filteredTasks.map((task) => {
                const isSelected = task.id === activeTaskId;
                return (
                  <div
                    key={task.id}
                    onClick={() => setActiveTaskId(task.id)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer text-left ${
                      isSelected
                        ? 'bg-cyan-950/30 border-cyan-500/50 shadow-md shadow-cyan-950/30'
                        : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-white line-clamp-1">{task.title}</h3>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider shrink-0 ${getStatusColor(
                          task.status
                        )}`}
                      >
                        {task.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                      <span className="capitalize text-cyan-400 font-mono">
                        {task.assigned_agent === 'research' ? '🔬 Research Agent' : '🤖 General Agent'}
                      </span>
                      <span>•</span>
                      <span>
                        Step {task.current_step}/{task.total_steps || '-'}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2.5">
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            task.status === 'completed'
                              ? 'bg-emerald-500'
                              : task.status === 'failed'
                              ? 'bg-rose-500'
                              : 'bg-cyan-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, task.progress))}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center mt-1 text-[10px] text-slate-500 font-mono">
                        <span>{task.progress.toFixed(0)}%</span>
                        <span>{new Date(task.updated_at || task.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Task Details & Controls */}
        <div className="col-span-7 flex flex-col min-h-0">
          {activeTask ? (
            <div className="flex flex-col h-full bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-4 overflow-y-auto">
              {/* Task Header & Primary Actions */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${getStatusColor(
                        activeTask.status
                      )}`}
                    >
                      {activeTask.status}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">ID: {activeTask.id.slice(0, 8)}...</span>
                  </div>
                  <h2 className="text-lg font-bold text-white mt-1.5">{activeTask.title}</h2>
                  <p className="text-xs text-slate-400 mt-1">{activeTask.request}</p>
                </div>

                {/* Control Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  {activeTask.status === 'running' && (
                    <>
                      <button
                        onClick={() => pauseTask(activeTask.id)}
                        className="px-2.5 py-1 text-xs font-medium rounded bg-amber-950/40 border border-amber-600/40 text-amber-300 hover:bg-amber-900/50"
                      >
                        Pause
                      </button>
                      <button
                        onClick={() => finishEarlyTask(activeTask.id)}
                        className="px-2.5 py-1 text-xs font-medium rounded bg-purple-950/40 border border-purple-600/40 text-purple-300 hover:bg-purple-900/50"
                      >
                        Finish Early
                      </button>
                      <button
                        onClick={() => cancelTask(activeTask.id)}
                        className="px-2.5 py-1 text-xs font-medium rounded bg-rose-950/40 border border-rose-600/40 text-rose-300 hover:bg-rose-900/50"
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {activeTask.status === 'paused' && (
                    <>
                      <button
                        onClick={() => resumeTask(activeTask.id)}
                        className="px-2.5 py-1 text-xs font-medium rounded bg-cyan-950/40 border border-cyan-600/40 text-cyan-300 hover:bg-cyan-900/50"
                      >
                        Resume
                      </button>
                      <button
                        onClick={() => cancelTask(activeTask.id)}
                        className="px-2.5 py-1 text-xs font-medium rounded bg-rose-950/40 border border-rose-600/40 text-rose-300 hover:bg-rose-900/50"
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {(activeTask.status === 'completed' || activeTask.report_path) && (
                    <button
                      onClick={() => fetchReport(activeTask.id)}
                      className="px-3 py-1 text-xs font-medium rounded bg-emerald-950/40 border border-emerald-600/40 text-emerald-300 hover:bg-emerald-900/50 flex items-center space-x-1"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span>View Report</span>
                    </button>
                  )}

                  {(activeTask.status === 'completed' || activeTask.status === 'failed' || activeTask.status === 'cancelled') && (
                    <>
                      <button
                        onClick={() => retryTask(activeTask.id)}
                        className="px-2.5 py-1 text-xs font-medium rounded bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700"
                      >
                        Retry
                      </button>
                      <button
                        onClick={() => deleteTask(activeTask.id)}
                        className="px-2.5 py-1 text-xs font-medium rounded bg-rose-950/20 border border-rose-800/30 text-rose-400 hover:bg-rose-900/30"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Live Steering Box */}
              {(activeTask.status === 'running' || activeTask.status === 'paused' || activeTask.status === 'queued') && (
                <div className="p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                      Live Agent Steering
                    </span>
                    <span className="text-[11px] text-slate-500">Inject directives into active run</span>
                  </div>

                  <form onSubmit={handleSteer} className="flex gap-2">
                    <input
                      type="text"
                      value={steeringText}
                      onChange={(e) => setSteeringText(e.target.value)}
                      placeholder="e.g. Focus specifically on bundle size benchmarks..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="submit"
                      disabled={!steeringText.trim()}
                      className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition"
                    >
                      Steer
                    </button>
                  </form>

                  {activeTask.steering_instructions && activeTask.steering_instructions.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                        Applied Steering Directives:
                      </span>
                      {activeTask.steering_instructions.map((inst, idx) => (
                        <div key={idx} className="text-xs text-cyan-300/90 bg-cyan-950/20 px-2 py-1 rounded border border-cyan-900/30">
                          • {typeof inst === 'string' ? inst : inst.instruction}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Error notice if failed */}
              {activeTask.error_info && (
                <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                  <span className="font-semibold">Error Details: </span>
                  {activeTask.error_info}
                </div>
              )}

              {/* Step Sequence Timeline */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Execution Plan & Sequential Steps</span>
                  <span className="font-mono text-cyan-400">
                    {activeTask.current_step} of {activeTask.total_steps} completed
                  </span>
                </div>

                <div className="space-y-2">
                  {activeTask.plan && activeTask.plan.length > 0 ? (
                    activeTask.plan.map((step) => {
                      const isExpanded = expandedStep === step.step_number;
                      return (
                        <div
                          key={step.step_number}
                          className="bg-slate-950/30 border border-slate-800 rounded-lg p-3 text-xs space-y-1.5 transition"
                        >
                          <div
                            onClick={() => setExpandedStep(isExpanded ? null : step.step_number)}
                            className="flex items-center justify-between cursor-pointer select-none"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-cyan-400 w-5">#{step.step_number}</span>
                              <span className="font-medium text-white">{step.title}</span>
                            </div>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full border uppercase ${
                                step.status === 'completed'
                                  ? 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30'
                                  : step.status === 'running'
                                  ? 'text-cyan-400 bg-cyan-950/40 border-cyan-500/30 animate-pulse'
                                  : 'text-slate-400 bg-slate-900 border-slate-800'
                              }`}
                            >
                              {step.status}
                            </span>
                          </div>

                          <p className="text-slate-400 text-[11px] pl-7">{step.description}</p>

                          {isExpanded && step.output && (
                            <div className="mt-2 pl-7 pt-2 border-t border-slate-800/80 text-[11px] text-cyan-200/90 font-mono bg-slate-900/60 p-2 rounded">
                              {step.output}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-slate-500 text-xs glass rounded-lg">
                      {activeTask.status === 'queued' ? 'Agent is analyzing request...' : 'No step plan generated yet.'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 glass rounded-xl border border-slate-800 text-slate-400">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-600 mb-3">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 12h6M12 9v6" />
              </svg>
              <h3 className="text-sm font-semibold text-white">No Task Selected</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Select a background task from the list or launch a new autonomous research investigation.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Task Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-base font-bold text-white">Start Background Agent Task</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Goal or Research Query *
                  </label>
                  <textarea
                    rows={3}
                    value={newRequest}
                    onChange={(e) => setNewRequest(e.target.value)}
                    placeholder="e.g. Compare SQLite with DuckDB for embedded local storage and benchmarks..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Short Title (Optional)
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. SQLite vs DuckDB Evaluation"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Autonomous Agent Assignment
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewAgent('research')}
                      className={`p-2.5 rounded-lg border text-left transition ${
                        newAgent === 'research'
                          ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-semibold text-white">🔬 Research Specialist</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Multi-source web research & report</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewAgent('general')}
                      className={`p-2.5 rounded-lg border text-left transition ${
                        newAgent === 'general'
                          ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-semibold text-white">🤖 General Agent</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Decomposition & task execution</div>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newRequest.trim() || isLoading}
                    className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-medium shadow-md shadow-cyan-950/40"
                  >
                    Launch Task
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {selectedReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-3xl h-[85vh] bg-slate-900 border border-slate-800 rounded-2xl flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Report Header */}
              <div className="p-4 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                <div>
                  <h3 className="text-base font-bold text-white">{selectedReport.title}</h3>
                  {selectedReport.report_path && (
                    <span className="text-[11px] text-slate-400 font-mono">
                      File: {selectedReport.report_path}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyReport}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 rounded-lg transition"
                  >
                    {copiedReport ? '✓ Copied!' : 'Copy Markdown'}
                  </button>
                  <button
                    onClick={clearReport}
                    className="p-1.5 text-slate-400 hover:text-white text-sm"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Report Markdown Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-sans selection:bg-cyan-500/30">
                {selectedReport.report_markdown}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
