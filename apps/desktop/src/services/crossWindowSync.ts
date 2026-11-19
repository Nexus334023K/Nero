import { useAppStore } from '../stores/appStore';
import { useCompanionStore } from '../stores/companionStore';
import type { AIState } from '../types';
import type { AnimationState, BubbleMessage, CompanionMood } from '../features/companion/types';

export type SyncMessage =
  | { type: 'AI_STATE'; payload: AIState }
  | { type: 'TRIGGER_BUBBLE'; payload: { text: string; duration?: number; bubbleType?: BubbleMessage['type'] } }
  | { type: 'DISMISS_BUBBLE' }
  | { type: 'PLAY_ONE_SHOT'; payload: { anim: AnimationState; durationMs?: number } }
  | { type: 'SET_MOOD'; payload: CompanionMood };

class CrossWindowSyncService {
  private channel: BroadcastChannel | null = null;
  private isReceiving = false;

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.channel = new BroadcastChannel('nero_cross_window_sync_channel');
        this.channel.onmessage = (event) => {
          this.applyMessage(event.data as SyncMessage);
        };
      }
    } catch (e) {
      console.warn('[CrossWindowSync] BroadcastChannel init warning:', e);
    }

    if (typeof window !== 'undefined' && window.electronAPI?.companion?.onSyncState) {
      window.electronAPI.companion.onSyncState((msg: unknown) => {
        this.applyMessage(msg as SyncMessage);
      });
    }
  }

  public broadcast(message: SyncMessage): void {
    if (this.isReceiving) return;

    try {
      this.channel?.postMessage(message);
    } catch {
      // Ignore
    }

    try {
      if (window.electronAPI?.companion?.syncState) {
        window.electronAPI.companion.syncState(message);
      }
    } catch {
      // Ignore
    }
  }

  private applyMessage(msg: SyncMessage): void {
    if (!msg || !msg.type) return;

    this.isReceiving = true;
    try {
      switch (msg.type) {
        case 'AI_STATE':
          useAppStore.setState({ aiState: msg.payload });
          break;
        case 'TRIGGER_BUBBLE':
          useCompanionStore.getState().triggerBubble(
            msg.payload.text,
            msg.payload.duration,
            msg.payload.bubbleType,
            false // don't re-broadcast
          );
          break;
        case 'DISMISS_BUBBLE':
          useCompanionStore.getState().dismissBubble(false);
          break;
        case 'PLAY_ONE_SHOT':
          useCompanionStore.getState().playOneShot(
            msg.payload.anim,
            msg.payload.durationMs,
            false
          );
          break;
        case 'SET_MOOD':
          useCompanionStore.getState().setMood(msg.payload, false);
          break;
      }
    } catch (e) {
      console.error('[CrossWindowSync] Error applying sync message:', e);
    } finally {
      this.isReceiving = false;
    }
  }
}

export const crossWindowSync = new CrossWindowSyncService();
