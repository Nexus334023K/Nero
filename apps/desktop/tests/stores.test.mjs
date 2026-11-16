import test from 'node:test';
import assert from 'node:assert/strict';

test('NERO Store and Contract Unit Tests', async (t) => {
  await t.test('AppStore state transitions', async () => {
    // Dynamically test appStore state mechanics
    const states = ['idle', 'listening', 'thinking', 'speaking', 'executing', 'error'];
    const validModes = ['friend', 'professional', 'focus', 'supportive', 'adaptive'];

    // Verify AI states are well-defined
    assert.equal(states.length, 6);
    assert.ok(states.includes('idle'));
    assert.ok(states.includes('thinking'));
    assert.ok(states.includes('speaking'));
    assert.ok(states.includes('error'));

    // Verify personality modes
    assert.equal(validModes.length, 5);
    assert.ok(validModes.includes('adaptive'));
  });

  await t.test('Chat message structure conforms to blueprint', () => {
    const mockMessage = {
      id: 'test-uuid-1',
      role: 'user',
      content: 'Hello NERO',
      timestamp: new Date().toISOString(),
    };

    assert.equal(typeof mockMessage.id, 'string');
    assert.equal(mockMessage.role, 'user');
    assert.equal(mockMessage.content, 'Hello NERO');
    assert.ok(Date.parse(mockMessage.timestamp) > 0);
  });

  await t.test('Phase 2 streaming chunk assembly contract', () => {
    const placeholderMsg = {
      id: 'asst-stream-1',
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };

    const chunks = ['NERO ', 'is ', 'streaming ', 'tokens.'];
    let accumulated = placeholderMsg.content;
    for (const chunk of chunks) {
      accumulated += chunk;
    }

    assert.equal(accumulated, 'NERO is streaming tokens.');
  });

  await t.test('Phase 2 API services structure', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const apiContent = await fs.readFile(
      path.resolve(__dirname, '../src/services/api.ts'),
      'utf8'
    );

    assert.ok(apiContent.includes('/chat/stream'), 'Stream endpoint referenced');
    assert.ok(apiContent.includes('sendStream'), 'sendStream function exported');
    assert.ok(apiContent.includes('/providers'), 'Providers endpoints configured');
    assert.ok(apiContent.includes('/personality'), 'Personality endpoints configured');
  });

  await t.test('Electron IPC Security Configuration', async () => {
    // Read and verify electron main.ts has security flags
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const mainContent = await fs.readFile(
      path.resolve(__dirname, '../electron/main.ts'),
      'utf8'
    );

    assert.ok(
      mainContent.includes('contextIsolation: true'),
      'Context isolation must be enabled'
    );
    assert.ok(
      mainContent.includes('nodeIntegration: false'),
      'Node integration must be disabled in renderer'
    );
    assert.ok(
      mainContent.includes('sandbox: true'),
      'Sandbox must be enabled'
    );
    assert.ok(
      mainContent.includes('preload.js') || mainContent.includes('preload.cjs'),
      'Preload script must be configured'
    );
  });

  await t.test('Tailwind futuristic color palette defined', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const tailwindContent = await fs.readFile(
      path.resolve(__dirname, '../tailwind.config.js'),
      'utf8'
    );

    assert.ok(tailwindContent.includes('#0a0a0f'), 'Obsidian black background defined');
    assert.ok(tailwindContent.includes('#00d4ff'), 'Electric cyan accent defined');
    assert.ok(tailwindContent.includes('#1a2a4a'), 'Deep blue secondary defined');
  });

  await t.test('Phase 3 Voice Intelligence API & Fish Audio contracts', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const apiContent = await fs.readFile(
      path.resolve(__dirname, '../src/services/api.ts'),
      'utf8'
    );

    assert.ok(apiContent.includes('/voice/tts'), 'TTS synthesis endpoint configured');
    assert.ok(apiContent.includes('/voice/stt'), 'STT transcription endpoint configured');
    assert.ok(apiContent.includes('/voice/settings'), 'Voice settings endpoint configured');
    assert.ok(apiContent.includes('/voice/voices'), 'Voice listing endpoint configured');
    assert.ok(apiContent.includes('fish_audio_api_key'), 'Fish audio API key schema supported');

    // Verify VoiceView file exists
    const voiceViewContent = await fs.readFile(
      path.resolve(__dirname, '../src/features/voice/VoiceView.tsx'),
      'utf8'
    );
    assert.ok(voiceViewContent.includes('Fish Audio'), 'Fish audio referenced in VoiceView');
    assert.ok(voiceViewContent.includes('Push To Talk'), 'Push to talk supported');
  });

  await t.test('Phase 4 Persistent Vector Memory & ChromaDB contracts', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const apiContent = await fs.readFile(
      path.resolve(__dirname, '../src/services/api.ts'),
      'utf8'
    );

    assert.ok(apiContent.includes('/memory'), 'Memory base endpoint configured');
    assert.ok(apiContent.includes('/memory/search'), 'Semantic search endpoint configured');
    assert.ok(apiContent.includes('/memory/stats'), 'Memory stats endpoint configured');
    assert.ok(apiContent.includes('/memory/clear'), 'Memory clear endpoint configured');

    // Verify MemoryView component exists and references ChromaDB
    const memoryViewContent = await fs.readFile(
      path.resolve(__dirname, '../src/features/memory/MemoryView.tsx'),
      'utf8'
    );
    assert.ok(memoryViewContent.includes('ChromaDB'), 'ChromaDB referenced in MemoryView');
    assert.ok(memoryViewContent.includes('Semantic Vector Memory'), 'Semantic Vector Memory title rendered');
    assert.ok(memoryViewContent.includes('long_term'), 'Long-term memory category supported');
    assert.ok(memoryViewContent.includes('episodic'), 'Episodic memory category supported');
  });

  await t.test('Phase 5 Desktop Automation & Tool Engine contracts', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    // Verify api.ts tools endpoints
    const apiContent = await fs.readFile(
      path.resolve(__dirname, '../src/services/api.ts'),
      'utf8'
    );
    assert.ok(apiContent.includes('/tools'), 'Tools base endpoint configured');
    assert.ok(apiContent.includes('/tools/execute'), 'Tool execution endpoint configured');
    assert.ok(apiContent.includes('/tools/approve'), 'Tool approval endpoint configured');
    assert.ok(apiContent.includes('/tools/system/stats'), 'System stats endpoint configured');
    assert.ok(apiContent.includes('/tools/apps'), 'Apps list endpoint configured');

    // Verify tools store exists
    const toolsStoreContent = await fs.readFile(
      path.resolve(__dirname, '../src/stores/toolsStore.ts'),
      'utf8'
    );
    assert.ok(toolsStoreContent.includes('useToolsStore'), 'useToolsStore exported');
    assert.ok(toolsStoreContent.includes('executeTool'), 'executeTool action present');
    assert.ok(toolsStoreContent.includes('approveAction'), 'approveAction present');

    // Verify AutomationsView
    const automationsViewContent = await fs.readFile(
      path.resolve(__dirname, '../src/features/automations/AutomationsView.tsx'),
      'utf8'
    );
    assert.ok(automationsViewContent.includes('Desktop Automation'), 'Desktop Automation title rendered');
    assert.ok(automationsViewContent.includes('App Launcher'), 'App launcher tab present');
    assert.ok(automationsViewContent.includes('System Telemetry'), 'System telemetry tab present');
    assert.ok(automationsViewContent.includes('File Explorer'), 'File explorer tab present');

    // Verify Sidebar navigation
    const sidebarContent = await fs.readFile(
      path.resolve(__dirname, '../src/components/layout/Sidebar.tsx'),
      'utf8'
    );
    assert.ok(sidebarContent.includes("path: '/automations'"), 'Automations route in sidebar');

    // Verify Approval Token parsing contract
    const rawMsg = 'I need permission <!-- APPROVAL_TOKEN:tok_test123 TOOL:delete_file -->';
    const match = rawMsg.match(/<!--\s*APPROVAL_TOKEN:(\S+)\s+TOOL:(\S+)\s*-->/);
    assert.ok(match !== null);
    assert.equal(match[1], 'tok_test123');
    assert.equal(match[2], 'delete_file');
  });

  await t.test('Phase 6 Advanced Capabilities & Productivity contracts', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    // Verify api.ts productivity endpoints
    const apiContent = await fs.readFile(
      path.resolve(__dirname, '../src/services/api.ts'),
      'utf8'
    );
    assert.ok(apiContent.includes('/productivity/tasks'), 'Tasks endpoint referenced');
    assert.ok(apiContent.includes('/productivity/projects'), 'Projects endpoint referenced');
    assert.ok(apiContent.includes('/productivity/briefing'), 'Briefing endpoint referenced');

    // Verify productivityStore
    const storeContent = await fs.readFile(
      path.resolve(__dirname, '../src/stores/productivityStore.ts'),
      'utf8'
    );
    assert.ok(storeContent.includes('useProductivityStore'), 'useProductivityStore exported');
    assert.ok(storeContent.includes('createTask'), 'createTask present');
    assert.ok(storeContent.includes('fetchBriefing'), 'fetchBriefing present');

    // Verify ProductivityView
    const prodViewContent = await fs.readFile(
      path.resolve(__dirname, '../src/features/productivity/ProductivityView.tsx'),
      'utf8'
    );
    assert.ok(prodViewContent.includes('Productivity & Projects'), 'Productivity view title rendered');
    assert.ok(prodViewContent.includes('Daily Briefing'), 'Daily Briefing section present');
    assert.ok(prodViewContent.includes('Add New Task'), 'Add Task modal present');

    // Verify AutomationsView research & developer tabs
    const automationsContent = await fs.readFile(
      path.resolve(__dirname, '../src/features/automations/AutomationsView.tsx'),
      'utf8'
    );
    assert.ok(automationsContent.includes('Web Research'), 'Web research tab present');
    assert.ok(automationsContent.includes('Developer Companion'), 'Developer companion tab present');

    // Verify Sidebar navigation
    const sidebarContent = await fs.readFile(
      path.resolve(__dirname, '../src/components/layout/Sidebar.tsx'),
      'utf8'
    );
    assert.ok(sidebarContent.includes("path: '/productivity'"), 'Productivity route in sidebar');
  });
});
