export type AnimationState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'talking'
  | 'happy'
  | 'surprised'
  | 'clicked'
  | 'sleeping';

export type CompanionMood = 'happy' | 'curious' | 'sleepy' | 'playful' | 'focused';

export interface PetStats {
  mood: CompanionMood;
  energy: number; // 0 - 100
  affection: number; // 0 - 100
  interactionCount: number;
  lastInteraction: string;
}

export interface AnimationConfig {
  name: AnimationState;
  sheetPath: string;
  framePath: string;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  fps: number;
  loop: boolean;
  priority: number; // Higher numbers override lower (e.g. clicked = 3, talking = 2, idle = 1)
}

export interface BubbleMessage {
  id: string;
  text: string;
  duration?: number;
  type?: 'greeting' | 'reaction' | 'ai' | 'status' | 'custom';
}
