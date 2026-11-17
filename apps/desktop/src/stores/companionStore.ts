import { create } from 'zustand';
import type { AnimationState, BubbleMessage, CompanionMood, PetStats } from '../features/companion/types';
import { CLICK_REACTIONS, PET_REACTIONS } from '../features/companion/data/personality';

const STORAGE_KEY = 'nero_companion_stats_v1';

function loadSavedStats(): PetStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        mood: parsed.mood || 'playful',
        energy: typeof parsed.energy === 'number' ? parsed.energy : 90,
        affection: typeof parsed.energy === 'number' ? parsed.affection : 50,
        interactionCount: parsed.interactionCount || 0,
        lastInteraction: parsed.lastInteraction || new Date().toISOString(),
      };
    }
  } catch {
    // Fall back to default
  }
  return {
    mood: 'playful',
    energy: 90,
    affection: 50,
    interactionCount: 0,
    lastInteraction: new Date().toISOString(),
  };
}

function saveStats(stats: PetStats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage errors
  }
}

interface CompanionStore {
  // Stats
  stats: PetStats;
  setMood: (mood: CompanionMood) => void;
  recordInteraction: (type?: 'click' | 'chat' | 'pet' | 'voice') => void;
  
  // Animation state (can be overridden temporarily)
  activeAnimation: AnimationState;
  overrideAnimation: AnimationState | null;
  setAnimation: (anim: AnimationState) => void;
  playOneShot: (anim: AnimationState, durationMs?: number) => void;
  
  // Speech bubble
  bubble: BubbleMessage | null;
  triggerBubble: (text: string, duration?: number, type?: BubbleMessage['type']) => void;
  dismissBubble: () => void;
  
  // Interactions
  triggerClickReaction: () => void;
  petCompanion: () => void;
  
  // Menu & Floating state
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  menuPosition: { x: number; y: number };
  setMenuPosition: (pos: { x: number; y: number }) => void;
  
  isFloating: boolean;
  setIsFloating: (floating: boolean) => void;
}

export const useCompanionStore = create<CompanionStore>((set, get) => ({
  stats: loadSavedStats(),
  setMood: (mood) => {
    const newStats: PetStats = { ...get().stats, mood, lastInteraction: new Date().toISOString() };
    saveStats(newStats);
    set({ stats: newStats });
  },
  recordInteraction: (type = 'click') => {
    const prev = get().stats;
    const bonusAffection = type === 'pet' ? 5 : type === 'chat' ? 3 : 1;
    const newAffection = Math.min(100, prev.affection + bonusAffection);
    const newStats: PetStats = {
      ...prev,
      affection: newAffection,
      interactionCount: prev.interactionCount + 1,
      lastInteraction: new Date().toISOString(),
    };
    saveStats(newStats);
    set({ stats: newStats });
  },

  activeAnimation: 'idle',
  overrideAnimation: null,
  setAnimation: (activeAnimation) => set({ activeAnimation }),
  playOneShot: (anim, durationMs = 1200) => {
    set({ overrideAnimation: anim });
    setTimeout(() => {
      if (get().overrideAnimation === anim) {
        set({ overrideAnimation: null });
      }
    }, durationMs);
  },

  bubble: null,
  triggerBubble: (text, duration = 4000, type = 'reaction') => {
    const id = Math.random().toString(36).substring(7);
    set({ bubble: { id, text, duration, type } });
  },
  dismissBubble: () => set({ bubble: null }),

  triggerClickReaction: () => {
    get().recordInteraction('click');
    get().playOneShot('clicked', 1100);
    const randomLine = CLICK_REACTIONS[Math.floor(Math.random() * CLICK_REACTIONS.length)];
    get().triggerBubble(randomLine, 3500, 'reaction');
  },

  petCompanion: () => {
    get().recordInteraction('pet');
    get().playOneShot('happy', 1500);
    const randomPetLine = PET_REACTIONS[Math.floor(Math.random() * PET_REACTIONS.length)];
    get().triggerBubble(randomPetLine, 4000, 'reaction');
  },

  menuOpen: false,
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  menuPosition: { x: 0, y: 0 },
  setMenuPosition: (menuPosition) => set({ menuPosition }),

  isFloating: false,
  setIsFloating: (isFloating) => set({ isFloating }),
}));
