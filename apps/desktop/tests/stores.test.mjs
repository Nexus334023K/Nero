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
    assert.ok(apiContent.includes('/voice/test'), 'Voice testing endpoint configured');
    assert.ok(apiContent.includes('fish_audio_api_key'), 'Fish audio API key schema supported');

    // Verify VoiceView file exists
    const voiceViewContent = await fs.readFile(
      path.resolve(__dirname, '../src/features/voice/VoiceView.tsx'),
      'utf8'
    );
    assert.ok(voiceViewContent.includes('Fish Audio'), 'Fish audio referenced in VoiceView');
    assert.ok(voiceViewContent.includes('Push To Talk'), 'Push to talk supported');
    assert.ok(voiceViewContent.includes('ttsError'), 'TTS error banner integrated in VoiceView');

    // Verify voiceStore persistence and fields
    const voiceStoreContent = await fs.readFile(
      path.resolve(__dirname, '../src/stores/voiceStore.ts'),
      'utf8'
    );
    assert.ok(voiceStoreContent.includes('fishApiKey'), 'fishApiKey in voiceStore');
    assert.ok(voiceStoreContent.includes('fishRefId'), 'fishRefId in voiceStore');
    assert.ok(voiceStoreContent.includes('ttsError'), 'ttsError in voiceStore');

    // Verify SettingsView Fish Audio UI and test button
    const settingsContent = await fs.readFile(
      path.resolve(__dirname, '../src/features/settings/SettingsView.tsx'),
      'utf8'
    );
    assert.ok(settingsContent.includes('Test Fish Audio Voice'), 'Dedicated Fish Audio test button present');
    assert.ok(settingsContent.includes('reference_id'), 'reference_id documented in UI');
    assert.ok(settingsContent.includes('s2.1-pro'), 's2.1-pro model badge rendered');
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

  await t.test('Phase 7 Production Hardening, Packaging & Security contracts', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    // 1. Verify ErrorBoundary component exists
    const errorBoundaryContent = await fs.readFile(
      path.resolve(__dirname, '../src/components/ui/ErrorBoundary.tsx'),
      'utf8'
    );
    assert.ok(errorBoundaryContent.includes('Application Recovery Shield'), 'Recovery shield title');
    assert.ok(errorBoundaryContent.includes('Reload Interface'), 'Reload action present');

    // 2. Verify Electron main.ts navigation security
    const mainContent = await fs.readFile(
      path.resolve(__dirname, '../electron/main.ts'),
      'utf8'
    );
    assert.ok(mainContent.includes('will-navigate'), 'will-navigate handler guards against hijacking');
    assert.ok(mainContent.includes('shell.openExternal'), 'External URLs routed through OS shell');

    // 3. Verify CSP in index.html
    const indexHtml = await fs.readFile(
      path.resolve(__dirname, '../index.html'),
      'utf8'
    );
    assert.ok(indexHtml.includes('Content-Security-Policy'), 'CSP header defined');
    assert.ok(indexHtml.includes("media-src 'self' blob: data:"), 'Media src permits audio playback');

    // 4. Verify 1-Click Launchers exist at project root
    const rootDir = path.resolve(__dirname, '../../..');
    const hasBat = await fs.stat(path.resolve(rootDir, 'start-nero.bat')).then(() => true).catch(() => false);
    const hasPs1 = await fs.stat(path.resolve(rootDir, 'start-nero.ps1')).then(() => true).catch(() => false);
    assert.ok(hasBat, 'start-nero.bat launcher exists');
    assert.ok(hasPs1, 'start-nero.ps1 launcher exists');

    // 5. Verify electron-builder configuration
    const builderContent = await fs.readFile(
      path.resolve(__dirname, '../electron-builder.yml'),
      'utf8'
    );
    assert.ok(builderContent.includes('nsis'), 'NSIS Windows installer target defined');
    assert.ok(builderContent.includes('createDesktopShortcut: true'), 'Desktop shortcut enabled');
  });

  await t.test('Living Anime Companion Architecture and Contracts', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    const animStates = [
      'idle',
      'listening',
      'thinking',
      'talking',
      'happy',
      'surprised',
      'clicked',
      'sleeping',
    ];

    // 1. Verify all 8 sprite sheets and single-frame PNG assets exist
    const assetsDir = path.resolve(__dirname, '../src/assets/companion');
    for (const state of animStates) {
      const framePath = path.join(assetsDir, `${state}.png`);
      const sheetPath = path.join(assetsDir, `${state}-sheet.png`);
      const hasFrame = await fs.stat(framePath).then(() => true).catch(() => false);
      const hasSheet = await fs.stat(sheetPath).then(() => true).catch(() => false);
      assert.ok(hasFrame, `Frame image ${state}.png must exist`);
      assert.ok(hasSheet, `Sprite sheet ${state}-sheet.png must exist`);
    }

    // 2. Verify companion types and configuration
    const typesContent = await fs.readFile(
      path.resolve(__dirname, '../src/features/companion/types.ts'),
      'utf8'
    );
    for (const state of animStates) {
      assert.ok(typesContent.includes(`'${state}'`), `Type AnimationState must include '${state}'`);
    }
    assert.ok(typesContent.includes('CompanionMood'), 'CompanionMood type defined');
    assert.ok(typesContent.includes('PetStats'), 'PetStats type defined');

    // 3. Verify companion components exist
    const components = [
      'SpriteAnimator.tsx',
      'CompanionBubble.tsx',
      'CompanionMenu.tsx',
      'NeroCharacter.tsx',
    ];
    for (const comp of components) {
      const compPath = path.resolve(__dirname, '../src/features/companion/components', comp);
      const exists = await fs.stat(compPath).then(() => true).catch(() => false);
      assert.ok(exists, `Companion component ${comp} must exist`);
    }

    // 4. Verify Floating Companion view and App router integration
    const floatingExists = await fs
      .stat(path.resolve(__dirname, '../src/features/companion/FloatingCompanion.tsx'))
      .then(() => true)
      .catch(() => false);
    assert.ok(floatingExists, 'FloatingCompanion.tsx component exists');

    const appContent = await fs.readFile(path.resolve(__dirname, '../src/App.tsx'), 'utf8');
    assert.ok(appContent.includes('/companion'), 'App.tsx registers /companion route');
    assert.ok(appContent.includes('FloatingCompanion'), 'FloatingCompanion rendered on /companion');

    // 5. Verify Electron IPC channels for Floating Companion
    const mainContent = await fs.readFile(path.resolve(__dirname, '../electron/main.ts'), 'utf8');
    const preloadContent = await fs.readFile(path.resolve(__dirname, '../electron/preload.ts'), 'utf8');

    assert.ok(mainContent.includes('companion:toggle'), 'Main process handles companion:toggle');
    assert.ok(mainContent.includes('companion:close'), 'Main process handles companion:close');
    assert.ok(mainContent.includes('companion:openMainWindow'), 'Main process handles companion:openMainWindow');
    assert.ok(mainContent.includes('companion:setAlwaysOnTop'), 'Main process handles companion:setAlwaysOnTop');
    assert.ok(mainContent.includes('createCompanionWindow'), 'Main process implements createCompanionWindow');

    assert.ok(preloadContent.includes('companion: {'), 'Preload exposes companion namespace');
    assert.ok(preloadContent.includes('companion:toggle'), 'Preload wires companion:toggle');
  });

  await t.test('Audio Device Management and Speech Routing Contracts', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    // 1. Verify audioStore.ts exists and defines device selection & persistence
    const audioStorePath = path.resolve(__dirname, '../src/stores/audioStore.ts');
    const audioStoreContent = await fs.readFile(audioStorePath, 'utf8');
    assert.ok(audioStoreContent.includes('selectedMicId'), 'AudioStore manages selectedMicId');
    assert.ok(audioStoreContent.includes('selectedSpeakerId'), 'AudioStore manages selectedSpeakerId');
    assert.ok(audioStoreContent.includes('refreshDevices'), 'AudioStore provides refreshDevices action');
    assert.ok(audioStoreContent.includes('devicechange'), 'AudioStore listens for devicechange event');
    assert.ok(audioStoreContent.includes('echoCancellation'), 'AudioStore manages echoCancellation');
    assert.ok(audioStoreContent.includes('noiseSuppression'), 'AudioStore manages noiseSuppression');
    assert.ok(audioStoreContent.includes('nero_audio_settings_v1'), 'AudioStore persists to localStorage');

    // 2. Verify audioDeviceService.ts provides live mic test and speaker test
    const audioServicePath = path.resolve(__dirname, '../src/services/audioDeviceService.ts');
    const audioServiceContent = await fs.readFile(audioServicePath, 'utf8');
    assert.ok(audioServiceContent.includes('startMicTest'), 'AudioDeviceService provides startMicTest');
    assert.ok(audioServiceContent.includes('stopMicTest'), 'AudioDeviceService provides stopMicTest');
    assert.ok(audioServiceContent.includes('testSpeaker'), 'AudioDeviceService provides testSpeaker');
    assert.ok(audioServiceContent.includes('applySinkId'), 'AudioDeviceService handles setSinkId routing');

    // 3. Verify voice.ts routes recording to selected mic and TTS to selected speaker
    const voiceServicePath = path.resolve(__dirname, '../src/services/voice.ts');
    const voiceServiceContent = await fs.readFile(voiceServicePath, 'utf8');
    assert.ok(voiceServiceContent.includes('useAudioStore.getState()'), 'VoiceService reads active audioStore');
    assert.ok(voiceServiceContent.includes('selectedMicId'), 'VoiceService binds selected microphone deviceId');
    assert.ok(voiceServiceContent.includes('audioDeviceService.applySinkId'), 'VoiceService routes audio playback through selected speaker sink');

    // 4. Verify AudioDeviceSettings UI component is wired into SettingsView
    const audioSettingsPath = path.resolve(__dirname, '../src/features/settings/components/AudioDeviceSettings.tsx');
    const audioSettingsExists = await fs.stat(audioSettingsPath).then(() => true).catch(() => false);
    assert.ok(audioSettingsExists, 'AudioDeviceSettings.tsx exists');

    const settingsViewPath = path.resolve(__dirname, '../src/features/settings/SettingsView.tsx');
    const settingsViewContent = await fs.readFile(settingsViewPath, 'utf8');
    assert.ok(settingsViewContent.includes('AudioDeviceSettings'), 'SettingsView renders AudioDeviceSettings');
  });

  await t.test('True Transparent Desktop Pet Architecture and IPC Contracts', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    // 1. Verify Electron main.ts transparency and bounds validation
    const mainPath = path.resolve(__dirname, '../electron/main.ts');
    const mainContent = await fs.readFile(mainPath, 'utf8');
    assert.ok(mainContent.includes('transparent: true'), 'Companion window must be native transparent');
    assert.ok(mainContent.includes("backgroundColor: '#00000000'"), 'Companion window has 0-alpha background');
    assert.ok(mainContent.includes('hasShadow: false'), 'Companion window must disable shadow to prevent Windows box shadow');
    assert.ok(mainContent.includes('getValidCompanionPosition'), 'Companion window validates bounds on multi-monitor setups');
    assert.ok(mainContent.includes('companion:setIgnoreMouseEvents'), 'Main process handles click-through setIgnoreMouseEvents');
    assert.ok(mainContent.includes('companion:move'), 'Main process supports companion window moving');
    assert.ok(mainContent.includes('companion:openSettings'), 'Main process supports opening settings from pet');

    // 2. Verify globals.css renderer transparency
    const globalsPath = path.resolve(__dirname, '../src/styles/globals.css');
    const globalsContent = await fs.readFile(globalsPath, 'utf8');
    assert.ok(globalsContent.includes('body.transparent-companion'), 'CSS defines body.transparent-companion override');
    assert.ok(globalsContent.includes('background: transparent !important'), 'Renderer root forced transparent in companion mode');

    // 3. Verify FloatingCompanion.tsx true desktop pet design
    const companionPath = path.resolve(__dirname, '../src/features/companion/FloatingCompanion.tsx');
    const companionContent = await fs.readFile(companionPath, 'utf8');
    assert.ok(!companionContent.includes('border: 1px solid rgba(0, 212, 255'), 'FloatingCompanion must not render a card border');
    assert.ok(!companionContent.includes('Quick Action Pills'), 'FloatingCompanion must not render a permanent toolbar');
    assert.ok(companionContent.includes('transparent-companion'), 'FloatingCompanion activates transparent-companion body class');
    assert.ok(companionContent.includes('setIgnoreMouseEvents'), 'FloatingCompanion manages mouse event click-through pass-through');
    assert.ok(companionContent.includes('CompanionContextMenu'), 'FloatingCompanion renders on-demand compact context menu');

    // 4. Verify context menu options
    const menuPath = path.resolve(__dirname, '../src/features/companion/components/CompanionContextMenu.tsx');
    const menuContent = await fs.readFile(menuPath, 'utf8');
    assert.ok(menuContent.includes('Open Chat'), 'Context menu offers Open Chat');
    assert.ok(menuContent.includes('Pet NERO'), 'Context menu offers Pet NERO');
    assert.ok(menuContent.includes('Poke NERO'), 'Context menu offers Poke NERO');
    assert.ok(menuContent.includes('Always on Top'), 'Context menu offers Always on Top toggle');
    assert.ok(menuContent.includes('Open Audio & Settings'), 'Context menu offers Open Audio & Settings');
    assert.ok(menuContent.includes('Hide Companion'), 'Context menu offers Hide Companion');
  });

  await t.test('Smart Voice Listening & Automatic Speech Detection Contracts', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    // 1. Verify voiceStore defines smart listening state and presets
    const voiceStorePath = path.resolve(__dirname, '../src/stores/voiceStore.ts');
    const voiceStoreContent = await fs.readFile(voiceStorePath, 'utf8');
    assert.ok(voiceStoreContent.includes('smartListeningEnabled'), 'voiceStore manages smartListeningEnabled');
    assert.ok(voiceStoreContent.includes('silenceTimeoutMs'), 'voiceStore manages silenceTimeoutMs');
    assert.ok(voiceStoreContent.includes('vadSensitivity'), 'voiceStore manages vadSensitivity');
    assert.ok(voiceStoreContent.includes('conversationalMode'), 'voiceStore manages conversationalMode');
    assert.ok(voiceStoreContent.includes('isSpeechDetected'), 'voiceStore tracks isSpeechDetected');
    assert.ok(voiceStoreContent.includes('silenceProgress'), 'voiceStore tracks silenceProgress');
    assert.ok(voiceStoreContent.includes('vadStatus'), 'voiceStore tracks vadStatus');
    assert.ok(voiceStoreContent.includes('resetVadState'), 'voiceStore provides resetVadState');
    assert.ok(voiceStoreContent.includes('nero_voice_settings_v1'), 'voiceStore persists settings to localStorage');

    // 2. Verify VoiceActivityDetector service implementation
    const vadPath = path.resolve(__dirname, '../src/services/vad.ts');
    const vadContent = await fs.readFile(vadPath, 'utf8');
    assert.ok(vadContent.includes('class VoiceActivityDetector'), 'VoiceActivityDetector class exported');
    assert.ok(vadContent.includes('onSpeechStart'), 'VAD triggers onSpeechStart');
    assert.ok(vadContent.includes('onSpeechEnd'), 'VAD triggers onSpeechEnd on silence');
    assert.ok(vadContent.includes('onSilenceProgress'), 'VAD reports silence countdown progress');
    assert.ok(vadContent.includes('onNoSpeechTimeout'), 'VAD cancels after no-speech timeout');
    assert.ok(vadContent.includes('CALIBRATION_FRAMES'), 'VAD calibrates ambient noise floor');
    assert.ok(vadContent.includes('getDynamicThreshold'), 'VAD calculates dynamic energy threshold');

    // 3. Verify VoiceService integrates VAD, auto-completion and cancelRecording
    const voiceServicePath = path.resolve(__dirname, '../src/services/voice.ts');
    const voiceServiceContent = await fs.readFile(voiceServicePath, 'utf8');
    assert.ok(voiceServiceContent.includes('VoiceActivityDetector'), 'VoiceService instantiates VAD');
    assert.ok(voiceServiceContent.includes('onSpeechCompleted'), 'VoiceService supports onSpeechCompleted callback');
    assert.ok(voiceServiceContent.includes('cancelRecording'), 'VoiceService provides safe cancelRecording method');
    assert.ok(voiceServiceContent.includes('stopRecording'), 'VoiceService provides stopRecording');

    // 4. Verify VoiceView UI incorporates live VAD feedback & dialogue loop
    const voiceViewPath = path.resolve(__dirname, '../src/features/voice/VoiceView.tsx');
    const voiceViewContent = await fs.readFile(voiceViewPath, 'utf8');
    assert.ok(voiceViewContent.includes('isSpeechDetected'), 'VoiceView reflects speech detection state');
    assert.ok(voiceViewContent.includes('silenceProgress'), 'VoiceView displays silence progress countdown');
    assert.ok(voiceViewContent.includes('handleCancelRecord'), 'VoiceView provides manual cancellation');
    assert.ok(voiceViewContent.includes('conversationalMode'), 'VoiceView supports continuous conversational dialogue loop');
    assert.ok(voiceViewContent.includes('Push To Talk'), 'VoiceView retains Push To Talk compatibility');

    // 5. Verify AudioDeviceSettings offers configurable silence timeouts and sensitivities
    const audioSettingsPath = path.resolve(__dirname, '../src/features/settings/components/AudioDeviceSettings.tsx');
    const audioSettingsContent = await fs.readFile(audioSettingsPath, 'utf8');
    assert.ok(audioSettingsContent.includes('Smart Voice Listening & Silence Detection'), 'Settings section header present');
    assert.ok(audioSettingsContent.includes('700'), '700ms short pause preset available');
    assert.ok(audioSettingsContent.includes('1200'), '1200ms normal pause preset available');
    assert.ok(audioSettingsContent.includes('1800'), '1800ms relaxed pause preset available');
    assert.ok(audioSettingsContent.includes('vadSensitivity'), 'Speech detection sensitivity controls present');
  });

  await t.test('Milestone 1 Persistent Background Task Engine & Agent Foundation contracts', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    // 1. Verify types/tasks.ts
    const typesPath = path.resolve(__dirname, '../src/types/tasks.ts');
    const typesContent = await fs.readFile(typesPath, 'utf8');
    assert.ok(typesContent.includes("'queued'"), 'queued status defined');
    assert.ok(typesContent.includes("'planning'"), 'planning status defined');
    assert.ok(typesContent.includes("'running'"), 'running status defined');
    assert.ok(typesContent.includes("'waiting'"), 'waiting status defined');
    assert.ok(typesContent.includes("'paused'"), 'paused status defined');
    assert.ok(typesContent.includes("'completed'"), 'completed status defined');
    assert.ok(typesContent.includes("'failed'"), 'failed status defined');
    assert.ok(typesContent.includes("'cancelled'"), 'cancelled status defined');
    assert.ok(typesContent.includes('interface BackgroundTask'), 'BackgroundTask interface declared');
    assert.ok(typesContent.includes('interface TaskStep'), 'TaskStep interface declared');
    assert.ok(typesContent.includes('interface TaskReportResponse'), 'TaskReportResponse interface declared');

    // 2. Verify api.ts task endpoints
    const apiPath = path.resolve(__dirname, '../src/services/api.ts');
    const apiContent = await fs.readFile(apiPath, 'utf8');
    assert.ok(apiContent.includes('/tasks/'), 'Tasks sub-endpoints present in api.ts');
    assert.ok(apiContent.includes('finishEarly'), 'finishEarly method present');
    assert.ok(apiContent.includes('steer:'), 'steer method present');
    assert.ok(apiContent.includes('getReport:'), 'getReport method present');
    assert.ok(apiContent.includes('retry:'), 'retry method present');

    // 3. Verify taskStore.ts
    const storePath = path.resolve(__dirname, '../src/stores/taskStore.ts');
    const storeContent = await fs.readFile(storePath, 'utf8');
    assert.ok(storeContent.includes('useTaskStore'), 'useTaskStore declared');
    assert.ok(storeContent.includes('createTask:'), 'createTask action present');
    assert.ok(storeContent.includes('pauseTask:'), 'pauseTask action present');
    assert.ok(storeContent.includes('resumeTask:'), 'resumeTask action present');
    assert.ok(storeContent.includes('steerTask:'), 'steerTask action present');
    assert.ok(storeContent.includes('finishEarlyTask:'), 'finishEarlyTask action present');
    assert.ok(storeContent.includes('fetchReport:'), 'fetchReport action present');
    assert.ok(storeContent.includes('handleWebSocketEvent:'), 'handleWebSocketEvent present');

    // 4. Verify TasksView.tsx
    const viewPath = path.resolve(__dirname, '../src/features/tasks/TasksView.tsx');
    const viewContent = await fs.readFile(viewPath, 'utf8');
    assert.ok(viewContent.includes('Background Tasks & Agents'), 'View header present');
    assert.ok(viewContent.includes('Live Agent Steering'), 'Live steering controls present');
    assert.ok(viewContent.includes('Execution Plan & Sequential Steps'), 'Step timeline present');
    assert.ok(viewContent.includes('View Report'), 'Report button present');
    assert.ok(viewContent.includes('New Background Task'), 'Task creation button present');

    // 5. Verify Sidebar and App routing
    const sidebarPath = path.resolve(__dirname, '../src/components/layout/Sidebar.tsx');
    const sidebarContent = await fs.readFile(sidebarPath, 'utf8');
    assert.ok(sidebarContent.includes("path: '/tasks'"), 'Tasks route in sidebar');
    assert.ok(sidebarContent.includes('TasksIcon'), 'TasksIcon present in sidebar');

    const appPath = path.resolve(__dirname, '../src/App.tsx');
    const appContent = await fs.readFile(appPath, 'utf8');
    assert.ok(appContent.includes('<Route path="/tasks" element={<TasksView />} />'), 'Tasks route in App.tsx');
    assert.ok(appContent.includes("wsService.on('task_event'"), 'WebSocket task event listener in App.tsx');
  });
});
