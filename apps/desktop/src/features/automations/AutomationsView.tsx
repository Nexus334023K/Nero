import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useToolsStore } from '../../stores/toolsStore';
import { Card } from '../../components/ui/Card';

export function AutomationsView() {
  const {
    systemStats,
    tools,
    availableApps,
    pendingApprovals,
    isLoadingTools,
    fetchSystemStats,
    fetchTools,
    fetchApps,
    fetchPendingApprovals,
    executeTool,
    approveAction,
    updateToolPermission,
  } = useToolsStore();

  const [activeTab, setActiveTab] = useState<'launcher' | 'system' | 'files' | 'permissions'>('launcher');
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);
  const [fsPath, setFsPath] = useState<string>('D:\\Nero');
  const [fsEntries, setFsEntries] = useState<Array<{ name: string; is_dir: boolean; size_bytes: number }>>([]);
  const [fsError, setFsError] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState<number>(50);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  useEffect(() => {
    void fetchSystemStats();
    void fetchTools();
    void fetchApps();
    void fetchPendingApprovals();

    const interval = setInterval(() => {
      void fetchSystemStats();
      void fetchPendingApprovals();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchSystemStats, fetchTools, fetchApps, fetchPendingApprovals]);

  // Initial volume sync
  useEffect(() => {
    void executeTool('volume_control', { action: 'get_volume' }).then((res) => {
      if (res.status === 'success' && res.result?.output) {
        const out = res.result.output as { level?: number; is_muted?: boolean };
        if (typeof out.level === 'number') setVolumeLevel(out.level);
        if (typeof out.is_muted === 'boolean') setIsMuted(out.is_muted);
      }
    });
  }, [executeTool]);

  const handleLaunch = async (appName: string) => {
    setLaunchMessage(`Launching ${appName}...`);
    const res = await executeTool('launch_application', { app_name: appName });
    if (res.status === 'success') {
      setLaunchMessage(res.result?.action_taken || `Successfully launched ${appName}`);
    } else if (res.status === 'approval_required') {
      setLaunchMessage(`Permission required for ${appName}. Check approvals tab.`);
    } else {
      setLaunchMessage(res.message || `Failed to launch ${appName}`);
    }
    setTimeout(() => setLaunchMessage(null), 4000);
  };

  const handleListDirectory = async () => {
    setFsError(null);
    setSelectedFileContent(null);
    const res = await executeTool('file_manager', { action: 'list_dir', path: fsPath });
    if (res.status === 'success' && res.result?.output) {
      const out = res.result.output as { entries: Array<{ name: string; is_dir: boolean; size_bytes: number }> };
      setFsEntries(out.entries || []);
    } else {
      setFsError(res.result?.error || res.message || 'Failed to list directory');
      setFsEntries([]);
    }
  };

  const handleReadFile = async (fileName: string) => {
    const fullPath = `${fsPath.replace(/[\\/]$/, '')}\\${fileName}`;
    const res = await executeTool('file_manager', { action: 'read_file', path: fullPath });
    if (res.status === 'success' && res.result?.output) {
      const out = res.result.output as { content: string };
      setSelectedFileContent(out.content);
    } else if (res.status === 'approval_required') {
      setSelectedFileContent(`[APPROVAL REQUIRED]: ${res.approval?.reason}`);
    } else {
      setSelectedFileContent(`Error reading file: ${res.result?.error || res.message}`);
    }
  };

  const handleVolumeChange = async (newVal: number) => {
    setVolumeLevel(newVal);
    await executeTool('volume_control', { action: 'set_volume', level: newVal });
  };

  const handleToggleMute = async () => {
    const res = await executeTool('volume_control', { action: 'toggle_mute' });
    if (res.status === 'success' && res.result?.output) {
      const out = res.result.output as { is_muted: boolean };
      setIsMuted(out.is_muted);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-nero-bg">
      {/* Header */}
      <div className="px-8 py-5 border-b border-nero-border flex items-center justify-between shrink-0 glass">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-nero-text font-mono">
              Desktop Automation
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-nero-cyan/15 text-nero-cyan border border-nero-cyan/30">
              Phase 5
            </span>
          </div>
          <p className="text-xs text-nero-muted mt-0.5">
            Permission-controlled Windows desktop tooling, system telemetry, and app launcher
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
          <button
            type="button"
            onClick={() => setActiveTab('launcher')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'launcher'
                ? 'bg-nero-cyan text-nero-bg font-semibold'
                : 'text-nero-muted hover:text-nero-text'
            }`}
          >
            App Launcher
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('system')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'system'
                ? 'bg-nero-cyan text-nero-bg font-semibold'
                : 'text-nero-muted hover:text-nero-text'
            }`}
          >
            System Telemetry
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('files')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'files'
                ? 'bg-nero-cyan text-nero-bg font-semibold'
                : 'text-nero-muted hover:text-nero-text'
            }`}
          >
            File Explorer
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('permissions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'permissions'
                ? 'bg-nero-cyan text-nero-bg font-semibold'
                : 'text-nero-muted hover:text-nero-text'
            }`}
          >
            Permissions ({tools.length})
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8 max-w-6xl w-full mx-auto flex flex-col gap-6">
        {/* Pending Approvals Banner */}
        {pendingApprovals.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase text-amber-300">
                Pending Security Approvals ({pendingApprovals.length})
              </span>
            </div>
            {pendingApprovals.map((appr) => (
              <div
                key={appr.token}
                className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5"
              >
                <div>
                  <span className="text-xs font-semibold text-nero-text">{appr.tool_name}</span>
                  <p className="text-[11px] text-nero-muted">{appr.reason}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void approveAction(appr.token, 'allow_once')}
                    className="px-3 py-1 text-xs font-medium rounded-lg bg-nero-cyan text-nero-bg hover:bg-nero-cyan/90 transition-colors"
                  >
                    Allow Once
                  </button>
                  <button
                    type="button"
                    onClick={() => void approveAction(appr.token, 'always_allow')}
                    className="px-3 py-1 text-xs font-medium rounded-lg bg-nero-cyan/15 text-nero-cyan border border-nero-cyan/40 hover:bg-nero-cyan/25 transition-colors"
                  >
                    Always Allow
                  </button>
                  <button
                    type="button"
                    onClick={() => void approveAction(appr.token, 'deny')}
                    className="px-3 py-1 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 1: App Launcher & Volume */}
        {activeTab === 'launcher' && (
          <div className="flex flex-col gap-6">
            {launchMessage && (
              <div className="p-3 rounded-xl bg-nero-cyan/10 border border-nero-cyan/30 text-xs font-mono text-nero-cyan flex items-center justify-between">
                <span>{launchMessage}</span>
              </div>
            )}

            {/* Quick App Launcher Grid */}
            <div>
              <h2 className="text-sm font-semibold text-nero-text mb-3 font-mono">
                Approved Application Launcher
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(availableApps.length > 0
                  ? availableApps.map((a) => ({
                      id: a.id,
                      name: a.name,
                      desc: a.description,
                      icon:
                        a.category === 'developer'
                          ? '⚡'
                          : a.category === 'browser'
                          ? '🌐'
                          : a.category === 'system'
                          ? '📁'
                          : '📝',
                      isInstalled: a.is_installed,
                    }))
                  : [
                      { id: 'notepad', name: 'Notepad', desc: 'Windows Text Editor', icon: '📝', isInstalled: true },
                      { id: 'calculator', name: 'Calculator', desc: 'Windows Calculator', icon: '🧮', isInstalled: true },
                      { id: 'explorer', name: 'File Explorer', desc: 'File Manager', icon: '📁', isInstalled: true },
                      { id: 'vscode', name: 'Visual Studio Code', desc: 'Code Editor', icon: '💻', isInstalled: true },
                      { id: 'browser', name: 'Web Browser', desc: 'Default Internet Browser', icon: '🌐', isInstalled: true },
                      { id: 'terminal', name: 'Terminal', desc: 'PowerShell Terminal', icon: '⚡', isInstalled: true },
                    ]
                ).map((app) => (
                  <motion.div
                    key={app.id}
                    whileHover={{ y: -2 }}
                    className="p-4 rounded-xl glass border border-white/5 flex flex-col justify-between gap-3 group hover:border-nero-cyan/40 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl p-2 rounded-lg bg-white/5">{app.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-nero-text">{app.name}</h3>
                          {app.isInstalled && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Installed on system" />
                          )}
                        </div>
                        <p className="text-xs text-nero-muted">{app.desc}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleLaunch(app.id)}
                      className="w-full py-2 rounded-lg bg-white/5 text-xs font-medium text-nero-cyan hover:bg-nero-cyan/15 border border-nero-cyan/30 transition-colors"
                    >
                      Launch Application
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Master Audio & Volume Control */}
            <Card className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-nero-text font-mono">
                    Master Audio & Volume
                  </h3>
                  <p className="text-xs text-nero-muted">
                    Read and adjust Windows system audio output level
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleToggleMute()}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono transition-colors ${
                    isMuted
                      ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                      : 'bg-white/5 text-nero-text hover:bg-white/10'
                  }`}
                >
                  {isMuted ? '🔇 Muted' : '🔊 Unmuted'}
                </button>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-xs text-nero-muted font-mono w-10">{volumeLevel}%</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volumeLevel}
                  onChange={(e) => void handleVolumeChange(Number(e.target.value))}
                  className="flex-1 accent-nero-cyan cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => void handleVolumeChange(Math.min(100, volumeLevel + 10))}
                  className="px-2.5 py-1 rounded bg-white/5 text-xs text-nero-text hover:bg-white/10 font-mono"
                >
                  +10%
                </button>
                <button
                  type="button"
                  onClick={() => void handleVolumeChange(Math.max(0, volumeLevel - 10))}
                  className="px-2.5 py-1 rounded bg-white/5 text-xs text-nero-text hover:bg-white/10 font-mono"
                >
                  -10%
                </button>
              </div>
            </Card>
          </div>
        )}

        {/* Tab 2: System Telemetry */}
        {activeTab === 'system' && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* CPU Gauge */}
              <Card className="flex flex-col gap-3">
                <span className="text-xs font-mono uppercase text-nero-muted tracking-wider">
                  Processor (CPU)
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-mono text-nero-cyan">
                    {systemStats?.cpu_percent ?? 0}%
                  </span>
                  <span className="text-xs text-nero-muted">load</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-nero-cyan rounded-full transition-all duration-500"
                    style={{ width: `${systemStats?.cpu_percent ?? 0}%` }}
                  />
                </div>
                <span className="text-[11px] text-nero-muted font-mono">
                  Platform: {systemStats?.platform.system} {systemStats?.platform.release}
                </span>
              </Card>

              {/* Memory (RAM) */}
              <Card className="flex flex-col gap-3">
                <span className="text-xs font-mono uppercase text-nero-muted tracking-wider">
                  Physical Memory (RAM)
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-mono text-purple-400">
                    {systemStats?.memory.percent ?? 0}%
                  </span>
                  <span className="text-xs text-nero-muted">
                    {systemStats?.memory
                      ? `${systemStats.memory.used_gb} / ${systemStats.memory.total_gb} GB`
                      : '—'}
                  </span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-purple-400 rounded-full transition-all duration-500"
                    style={{ width: `${systemStats?.memory.percent ?? 0}%` }}
                  />
                </div>
                <span className="text-[11px] text-nero-muted font-mono">
                  Available: {systemStats?.memory.available_gb ?? '—'} GB
                </span>
              </Card>

              {/* System Uptime */}
              <Card className="flex flex-col gap-3">
                <span className="text-xs font-mono uppercase text-nero-muted tracking-wider">
                  System Uptime
                </span>
                <span className="text-2xl font-bold font-mono text-emerald-400">
                  {systemStats?.uptime.formatted ?? '—'}
                </span>
                <div className="flex items-center justify-between text-xs text-nero-muted mt-2">
                  <span>Battery</span>
                  <span className="font-mono text-nero-text">
                    {systemStats?.battery
                      ? `${systemStats.battery.percent}% (${systemStats.battery.power_plugged ? 'Charging' : 'Battery'})`
                      : 'AC / Desktop'}
                  </span>
                </div>
              </Card>
            </div>

            {/* Disks Table */}
            <Card className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-nero-text font-mono">Storage Volumes</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-white/10 text-nero-muted font-mono">
                      <th className="pb-2">Drive</th>
                      <th className="pb-2">Mount</th>
                      <th className="pb-2">Used</th>
                      <th className="pb-2">Total</th>
                      <th className="pb-2">Usage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {systemStats?.disks.map((d) => (
                      <tr key={d.mountpoint}>
                        <td className="py-2.5 text-nero-cyan">{d.device}</td>
                        <td className="py-2.5 text-nero-muted">{d.mountpoint}</td>
                        <td className="py-2.5 text-nero-text">{d.used_gb} GB</td>
                        <td className="py-2.5 text-nero-muted">{d.total_gb} GB</td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-white/5 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full bg-nero-cyan rounded-full"
                                style={{ width: `${d.percent}%` }}
                              />
                            </div>
                            <span className="text-nero-muted">{d.percent}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Tab 3: Safe Filesystem Explorer */}
        {activeTab === 'files' && (
          <div className="flex flex-col gap-4">
            <Card className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-nero-text font-mono">
                    Safe Directory Explorer
                  </h3>
                  <p className="text-xs text-nero-muted">
                    Path-traversal guarded file explorer with strict security boundaries
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={fsPath}
                  onChange={(e) => setFsPath(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-nero-text focus:outline-none focus:border-nero-cyan"
                  placeholder="Target directory path..."
                />
                <button
                  type="button"
                  onClick={() => void handleListDirectory()}
                  className="px-4 py-2 rounded-lg bg-nero-cyan text-nero-bg font-semibold text-xs hover:bg-nero-cyan/90 transition-colors"
                >
                  List Contents
                </button>
              </div>

              {fsError && (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-mono">
                  {fsError}
                </div>
              )}

              {/* Directory Listing */}
              {fsEntries.length > 0 && (
                <div className="mt-2 border border-white/5 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-white/5 text-nero-muted font-mono sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Size</th>
                        <th className="px-3 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {fsEntries.map((item) => (
                        <tr key={item.name} className="hover:bg-white/5 transition-colors">
                          <td className="px-3 py-2 text-nero-text font-medium flex items-center gap-2">
                            <span>{item.is_dir ? '📁' : '📄'}</span>
                            <span>{item.name}</span>
                          </td>
                          <td className="px-3 py-2 text-nero-muted">
                            {item.is_dir ? 'Directory' : 'File'}
                          </td>
                          <td className="px-3 py-2 text-nero-muted">
                            {!item.is_dir ? `${Math.round(item.size_bytes / 1024)} KB` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {!item.is_dir && (
                              <button
                                type="button"
                                onClick={() => void handleReadFile(item.name)}
                                className="text-nero-cyan hover:underline text-[11px]"
                              >
                                Read
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Selected File Content Preview */}
              {selectedFileContent !== null && (
                <div className="mt-3 p-3 rounded-xl bg-black/40 border border-white/10 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-nero-cyan">File Preview</span>
                    <button
                      type="button"
                      onClick={() => setSelectedFileContent(null)}
                      className="text-xs text-nero-muted hover:text-nero-text"
                    >
                      Close
                    </button>
                  </div>
                  <pre className="p-2 rounded bg-black/50 text-[11px] font-mono text-nero-text max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {selectedFileContent}
                  </pre>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Tab 4: Tool Permissions & Security Policy */}
        {activeTab === 'permissions' && (
          <div className="flex flex-col gap-4">
            <Card className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-nero-text font-mono">
                Desktop Tool Security Policies
              </h3>
              <p className="text-xs text-nero-muted">
                Each tool operates under a strict permission tier: Auto (safe, immediate), Permission
                Required (user approval), or Explicit Confirmation (irreversible actions).
              </p>

              {isLoadingTools ? (
                <div className="py-8 text-center text-xs text-nero-muted">Loading tools...</div>
              ) : (
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-white/10 text-nero-muted font-mono">
                        <th className="pb-2">Tool Name</th>
                        <th className="pb-2">Description</th>
                        <th className="pb-2">Security Level</th>
                        <th className="pb-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {tools.map((t) => (
                        <tr key={t.name}>
                          <td className="py-3 font-mono font-medium text-nero-cyan">{t.name}</td>
                          <td className="py-3 text-nero-muted max-w-sm">{t.description}</td>
                          <td className="py-3">
                            <select
                              value={t.configured_permission}
                              onChange={(e) =>
                                void updateToolPermission(t.name, e.target.value, t.is_enabled)
                              }
                              className="px-2 py-1 rounded bg-white/5 border border-white/10 font-mono text-[11px] text-nero-text focus:outline-none focus:border-nero-cyan"
                            >
                              <option value="auto">Auto (Immediate)</option>
                              <option value="permission_required">Permission Required</option>
                              <option value="explicit_confirmation">Explicit Confirmation</option>
                            </select>
                          </td>
                          <td className="py-3 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                void updateToolPermission(
                                  t.name,
                                  t.configured_permission,
                                  !t.is_enabled,
                                )
                              }
                              className={`px-2.5 py-1 rounded-full text-[10px] font-mono transition-colors ${
                                t.is_enabled
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-white/5 text-nero-muted'
                              }`}
                            >
                              {t.is_enabled ? 'Enabled' : 'Disabled'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
