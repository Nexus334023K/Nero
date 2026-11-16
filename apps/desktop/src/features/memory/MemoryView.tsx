import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

interface MemoryItem {
  id: string;
  content: string;
  importance: number;
  memory_type: string;
  tags: string[];
  created_at: string;
  accessed_at?: string;
}

interface MemoryStats {
  total_memories: number;
  long_term_count: number;
  episodic_count: number;
  vector_store_ready: boolean;
  memory_enabled: boolean;
}

export function MemoryView() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'long_term' | 'episodic'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState('long_term');
  const [newImportance, setNewImportance] = useState(0.8);
  const [newTagInput, setNewTagInput] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const typeParam = activeTab === 'all' ? undefined : activeTab;
      const [listRes, statsRes] = await Promise.all([
        api.memory.list({ memory_type: typeParam, search: searchQuery || undefined }),
        api.memory.stats(),
      ]);

      if (listRes?.memories) setMemories(listRes.memories);
      if (statsRes) setStats(statsRes);
    } catch (err) {
      console.warn('Memory load notice:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [activeTab]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      void loadData();
      return;
    }

    setIsLoading(true);
    try {
      const searchRes = await api.memory.search(
        searchQuery,
        10,
        activeTab === 'all' ? undefined : activeTab
      );
      if (searchRes?.results) {
        // Map vector results to memory items
        setMemories(
          searchRes.results.map((r) => ({
            id: r.id,
            content: r.content,
            importance: typeof r.metadata?.importance === 'number' ? r.metadata.importance : 0.8,
            memory_type: (r.metadata?.memory_type as string) || 'long_term',
            tags: typeof r.metadata?.tags === 'string' ? r.metadata.tags.split(',').filter(Boolean) : [],
            created_at: new Date().toISOString(),
          }))
        );
      }
    } catch {
      void loadData();
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    try {
      const tags = newTagInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await api.memory.create({
        content: newContent,
        memory_type: newType,
        importance: newImportance,
        tags,
      });

      setNewContent('');
      setNewTagInput('');
      setShowAddModal(false);
      setNotification('Memory saved and vector indexed!');
      setTimeout(() => setNotification(null), 3000);
      void loadData();
    } catch (err) {
      alert('Could not save memory. Sensitive credentials or invalid content are blocked.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this memory? It will be permanently removed from SQLite and ChromaDB.')) return;
    try {
      await api.memory.delete(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
      if (stats) setStats({ ...stats, total_memories: Math.max(0, stats.total_memories - 1) });
    } catch (err) {
      console.warn('Delete error:', err);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to purge all memories? This cannot be undone.')) return;
    try {
      await api.memory.clear();
      setMemories([]);
      setNotification('All vector and relational memories cleared.');
      setTimeout(() => setNotification(null), 3000);
      void loadData();
    } catch (err) {
      console.warn('Clear error:', err);
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-nero-bg p-8">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-6 border-b border-nero-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-nero-text flex items-center gap-3">
            <span>Semantic Vector Memory</span>
            <span className="text-xs px-2.5 py-1 rounded-full border border-nero-cyan/30 bg-nero-cyan/10 text-nero-cyan font-mono">
              ChromaDB + SQLite
            </span>
          </h1>
          <p className="text-xs text-nero-muted mt-1">
            Persistent working, long-term, and episodic user memories recalled automatically during conversations
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={handleClearAll} className="text-xs">
            Purge All
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)} className="text-xs">
            + New Memory
          </Button>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono"
        >
          {notification}
        </motion.div>
      )}

      {/* High-Level Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
        <Card className="flex flex-col" animate={false}>
          <span className="text-[10px] font-mono text-nero-muted uppercase">Total Memories</span>
          <span className="text-2xl font-bold text-nero-cyan mt-1">{stats?.total_memories ?? memories.length}</span>
          <span className="text-[10px] text-nero-muted mt-0.5">Persisted in SQLite</span>
        </Card>

        <Card className="flex flex-col" animate={false}>
          <span className="text-[10px] font-mono text-nero-muted uppercase">Long-Term Facts</span>
          <span className="text-2xl font-bold text-nero-text mt-1">{stats?.long_term_count ?? 0}</span>
          <span className="text-[10px] text-nero-muted mt-0.5">Preferences & profile</span>
        </Card>

        <Card className="flex flex-col" animate={false}>
          <span className="text-[10px] font-mono text-nero-muted uppercase">Episodic History</span>
          <span className="text-2xl font-bold text-nero-text mt-1">{stats?.episodic_count ?? 0}</span>
          <span className="text-[10px] text-nero-muted mt-0.5">Completed projects & events</span>
        </Card>

        <Card className="flex flex-col" animate={false}>
          <span className="text-[10px] font-mono text-nero-muted uppercase">ChromaDB Vector Store</span>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
            <span className="text-sm font-semibold text-nero-text font-mono">ONLINE</span>
          </div>
          <span className="text-[10px] text-nero-muted mt-0.5">Semantic indexing active</span>
        </Card>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl glass border border-white/5">
          {(['all', 'long_term', 'episodic'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                activeTab === tab
                  ? 'bg-nero-cyan/20 text-nero-cyan border border-nero-cyan/30'
                  : 'text-nero-muted hover:text-white'
              }`}
            >
              {tab === 'all' ? 'All Memories' : tab.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Semantic Search Bar */}
        <form onSubmit={handleSearch} className="flex items-center gap-2 w-full md:w-96">
          <input
            type="text"
            placeholder="Search memories semantically..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-xs font-mono bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-nero-text focus:border-nero-cyan/50 outline-none"
          />
          <Button type="submit" size="sm" variant="secondary">
            Search
          </Button>
        </form>
      </div>

      {/* Memory Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-nero-muted text-xs font-mono">
          Loading memories...
        </div>
      ) : memories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center glass rounded-2xl border border-white/5 p-8">
          <div className="w-12 h-12 rounded-xl bg-nero-cyan/10 border border-nero-cyan/30 flex items-center justify-center mb-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-nero-cyan">
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-nero-text">No Memories Found</h3>
          <p className="text-xs text-nero-muted max-w-sm mt-1">
            NERO extracts personal preferences and facts automatically as you chat, or you can add memories manually above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {memories.map((mem) => {
            const importancePct = Math.round(mem.importance * 100);
            return (
              <motion.div
                key={mem.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-xl p-4 border border-white/10 hover:border-nero-cyan/30 flex flex-col justify-between transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-nero-cyan uppercase">
                      {mem.memory_type.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] font-mono text-nero-muted">
                      Importance: <span className="text-nero-cyan font-bold">{importancePct}%</span>
                    </span>
                  </div>

                  <p className="text-xs text-nero-text leading-relaxed font-sans">{mem.content}</p>

                  {mem.tags && mem.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {mem.tags.map((t, idx) => (
                        <span key={idx} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-nero-muted">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/5 text-[10px] text-nero-muted font-mono">
                  <span>{new Date(mem.created_at).toLocaleDateString()}</span>
                  <button
                    onClick={() => handleDelete(mem.id)}
                    className="text-nero-muted hover:text-red-400 transition-colors cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add Memory Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0e0e16] border border-white/15 rounded-2xl p-6 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-nero-text font-mono uppercase tracking-wider">
                  Store New Memory
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-nero-muted hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddMemory} className="flex flex-col gap-4">
                <div>
                  <label className="text-[10px] font-mono uppercase text-nero-muted block mb-1">
                    Memory Content / Fact
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g., User prefers dark mode and uses TypeScript with React..."
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="w-full text-xs font-sans bg-black/60 border border-white/10 rounded-lg p-2.5 text-nero-text focus:border-nero-cyan/50 outline-none resize-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono uppercase text-nero-muted block mb-1">
                      Category
                    </label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value)}
                      className="w-full text-xs bg-black/60 border border-white/10 rounded-lg p-2 text-nero-text outline-none"
                    >
                      <option value="long_term">Long-Term Memory</option>
                      <option value="episodic">Episodic Memory</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono uppercase text-nero-muted block mb-1">
                      Importance: {Math.round(newImportance * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={newImportance}
                      onChange={(e) => setNewImportance(parseFloat(e.target.value))}
                      className="w-full mt-2 accent-nero-cyan"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase text-nero-muted block mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. preference, frontend, stack"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    className="w-full text-xs font-mono bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-nero-text focus:border-nero-cyan/50 outline-none"
                  />
                </div>

                <div className="flex items-center gap-3 mt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 justify-center text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    className="flex-1 justify-center text-xs"
                  >
                    Index Memory
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
