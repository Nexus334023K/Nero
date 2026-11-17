import { create } from 'zustand';

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
  isDefault: boolean;
}

interface AudioPreferences {
  selectedMicId: string;
  selectedSpeakerId: string;
  inputGain: number; // 0.0 - 2.0 (1.0 default)
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

const STORAGE_KEY = 'nero_audio_settings_v1';

function loadSavedAudioPrefs(): AudioPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        selectedMicId: parsed.selectedMicId || 'default',
        selectedSpeakerId: parsed.selectedSpeakerId || 'default',
        inputGain: typeof parsed.inputGain === 'number' ? parsed.inputGain : 1.0,
        echoCancellation: parsed.echoCancellation ?? true,
        noiseSuppression: parsed.noiseSuppression ?? true,
        autoGainControl: parsed.autoGainControl ?? true,
      };
    }
  } catch {
    // Fall back to defaults
  }
  return {
    selectedMicId: 'default',
    selectedSpeakerId: 'default',
    inputGain: 1.0,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
}

function saveAudioPrefs(prefs: AudioPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors
  }
}

interface AudioStoreState extends AudioPreferences {
  microphones: AudioDevice[];
  speakers: AudioDevice[];
  permissionGranted: boolean;
  deviceWarning: string | null;
  isLoadingDevices: boolean;

  setSelectedMicId: (id: string) => void;
  setSelectedSpeakerId: (id: string) => void;
  setInputGain: (gain: number) => void;
  setEchoCancellation: (val: boolean) => void;
  setNoiseSuppression: (val: boolean) => void;
  setAutoGainControl: (val: boolean) => void;
  setDeviceWarning: (msg: string | null) => void;

  refreshDevices: (skipPermissionRequest?: boolean) => Promise<void>;
  requestPermission: () => Promise<boolean>;
  initDeviceListener: () => () => void;
}

export const useAudioStore = create<AudioStoreState>((set, get) => {
  const initialPrefs = loadSavedAudioPrefs();

  return {
    ...initialPrefs,
    microphones: [],
    speakers: [],
    permissionGranted: false,
    deviceWarning: null,
    isLoadingDevices: false,

    setSelectedMicId: (selectedMicId: string) => {
      set({ selectedMicId, deviceWarning: null });
      const current = get();
      saveAudioPrefs({
        selectedMicId,
        selectedSpeakerId: current.selectedSpeakerId,
        inputGain: current.inputGain,
        echoCancellation: current.echoCancellation,
        noiseSuppression: current.noiseSuppression,
        autoGainControl: current.autoGainControl,
      });
    },

    setSelectedSpeakerId: (selectedSpeakerId: string) => {
      set({ selectedSpeakerId, deviceWarning: null });
      const current = get();
      saveAudioPrefs({
        selectedMicId: current.selectedMicId,
        selectedSpeakerId,
        inputGain: current.inputGain,
        echoCancellation: current.echoCancellation,
        noiseSuppression: current.noiseSuppression,
        autoGainControl: current.autoGainControl,
      });
    },

    setInputGain: (inputGain: number) => {
      set({ inputGain });
      const current = get();
      saveAudioPrefs({
        selectedMicId: current.selectedMicId,
        selectedSpeakerId: current.selectedSpeakerId,
        inputGain,
        echoCancellation: current.echoCancellation,
        noiseSuppression: current.noiseSuppression,
        autoGainControl: current.autoGainControl,
      });
    },

    setEchoCancellation: (echoCancellation: boolean) => {
      set({ echoCancellation });
      const current = get();
      saveAudioPrefs({
        selectedMicId: current.selectedMicId,
        selectedSpeakerId: current.selectedSpeakerId,
        inputGain: current.inputGain,
        echoCancellation,
        noiseSuppression: current.noiseSuppression,
        autoGainControl: current.autoGainControl,
      });
    },

    setNoiseSuppression: (noiseSuppression: boolean) => {
      set({ noiseSuppression });
      const current = get();
      saveAudioPrefs({
        selectedMicId: current.selectedMicId,
        selectedSpeakerId: current.selectedSpeakerId,
        inputGain: current.inputGain,
        echoCancellation: current.echoCancellation,
        noiseSuppression,
        autoGainControl: current.autoGainControl,
      });
    },

    setAutoGainControl: (autoGainControl: boolean) => {
      set({ autoGainControl });
      const current = get();
      saveAudioPrefs({
        selectedMicId: current.selectedMicId,
        selectedSpeakerId: current.selectedSpeakerId,
        inputGain: current.inputGain,
        echoCancellation: current.echoCancellation,
        noiseSuppression: current.noiseSuppression,
        autoGainControl,
      });
    },

    setDeviceWarning: (deviceWarning: string | null) => set({ deviceWarning }),

    requestPermission: async () => {
      if (!navigator.mediaDevices?.getUserMedia) return false;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        set({ permissionGranted: true });
        await get().refreshDevices(true);
        return true;
      } catch (err) {
        console.warn('Microphone permission denied or unavailable:', err);
        set({ permissionGranted: false });
        return false;
      }
    },

    refreshDevices: async (skipPermissionRequest = false) => {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      set({ isLoadingDevices: true });

      try {
        let devices = await navigator.mediaDevices.enumerateDevices();

        // Check if labels are missing (which happens if permission wasn't granted yet)
        const hasLabels = devices.some((d) => d.kind === 'audioinput' && d.label.length > 0);
        if (!hasLabels && !skipPermissionRequest) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((track) => track.stop());
            set({ permissionGranted: true });
            devices = await navigator.mediaDevices.enumerateDevices();
          } catch {
            // Permission not granted, continue with available device IDs
          }
        } else if (hasLabels) {
          set({ permissionGranted: true });
        }

        const mics: AudioDevice[] = [];
        const spks: AudioDevice[] = [];

        let micIndex = 1;
        let spkIndex = 1;

        for (const d of devices) {
          const isDefault = d.deviceId === 'default' || d.label.toLowerCase().includes('default');
          if (d.kind === 'audioinput') {
            mics.push({
              deviceId: d.deviceId,
              label: d.label || `Microphone ${micIndex++}`,
              kind: 'audioinput',
              isDefault,
            });
          } else if (d.kind === 'audiooutput') {
            spks.push({
              deviceId: d.deviceId,
              label: d.label || `Speaker ${spkIndex++}`,
              kind: 'audiooutput',
              isDefault,
            });
          }
        }

        const currentMicId = get().selectedMicId;
        const currentSpeakerId = get().selectedSpeakerId;

        let warning: string | null = null;
        let newMicId = currentMicId;
        let newSpeakerId = currentSpeakerId;

        // Check if previously selected microphone disconnected
        if (
          currentMicId !== 'default' &&
          mics.length > 0 &&
          !mics.some((m) => m.deviceId === currentMicId)
        ) {
          warning = `Selected microphone disconnected. Switched to default system microphone.`;
          newMicId = 'default';
        }

        // Check if previously selected speaker disconnected
        if (
          currentSpeakerId !== 'default' &&
          spks.length > 0 &&
          !spks.some((s) => s.deviceId === currentSpeakerId)
        ) {
          const spkMsg = `Selected speaker/headphones disconnected. Switched to default audio output.`;
          warning = warning ? `${warning} ${spkMsg}` : spkMsg;
          newSpeakerId = 'default';
        }

        set({
          microphones: mics,
          speakers: spks,
          selectedMicId: newMicId,
          selectedSpeakerId: newSpeakerId,
          deviceWarning: warning,
          isLoadingDevices: false,
        });

        // Save updated IDs if they fell back
        if (newMicId !== currentMicId || newSpeakerId !== currentSpeakerId) {
          const current = get();
          saveAudioPrefs({
            selectedMicId: newMicId,
            selectedSpeakerId: newSpeakerId,
            inputGain: current.inputGain,
            echoCancellation: current.echoCancellation,
            noiseSuppression: current.noiseSuppression,
            autoGainControl: current.autoGainControl,
          });
        }
      } catch (err) {
        console.error('Error enumerating audio devices:', err);
        set({ isLoadingDevices: false });
      }
    },

    initDeviceListener: () => {
      if (!navigator.mediaDevices?.addEventListener) return () => {};

      const handleDeviceChange = () => {
        void get().refreshDevices(true);
      };

      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      void get().refreshDevices(true);

      return () => {
        navigator.mediaDevices?.removeEventListener('devicechange', handleDeviceChange);
      };
    },
  };
});
