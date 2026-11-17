import type { AnimationConfig, AnimationState } from '../types';

import idleSheet from '../../../assets/companion/idle-sheet.png';
import idleFrame from '../../../assets/companion/idle.png';

import listeningSheet from '../../../assets/companion/listening-sheet.png';
import listeningFrame from '../../../assets/companion/listening.png';

import thinkingSheet from '../../../assets/companion/thinking-sheet.png';
import thinkingFrame from '../../../assets/companion/thinking.png';

import talkingSheet from '../../../assets/companion/talking-sheet.png';
import talkingFrame from '../../../assets/companion/talking.png';

import happySheet from '../../../assets/companion/happy-sheet.png';
import happyFrame from '../../../assets/companion/happy.png';

import surprisedSheet from '../../../assets/companion/surprised-sheet.png';
import surprisedFrame from '../../../assets/companion/surprised.png';

import clickedSheet from '../../../assets/companion/clicked-sheet.png';
import clickedFrame from '../../../assets/companion/clicked.png';

import sleepingSheet from '../../../assets/companion/sleeping-sheet.png';
import sleepingFrame from '../../../assets/companion/sleeping.png';

export const ANIMATION_CONFIGS: Record<AnimationState, AnimationConfig> = {
  idle: {
    name: 'idle',
    sheetPath: idleSheet,
    framePath: idleFrame,
    frameCount: 8,
    frameWidth: 256,
    frameHeight: 256,
    fps: 8,
    loop: true,
    priority: 1,
  },
  listening: {
    name: 'listening',
    sheetPath: listeningSheet,
    framePath: listeningFrame,
    frameCount: 8,
    frameWidth: 256,
    frameHeight: 256,
    fps: 10,
    loop: true,
    priority: 2,
  },
  thinking: {
    name: 'thinking',
    sheetPath: thinkingSheet,
    framePath: thinkingFrame,
    frameCount: 8,
    frameWidth: 256,
    frameHeight: 256,
    fps: 8,
    loop: true,
    priority: 2,
  },
  talking: {
    name: 'talking',
    sheetPath: talkingSheet,
    framePath: talkingFrame,
    frameCount: 8,
    frameWidth: 256,
    frameHeight: 256,
    fps: 10,
    loop: true,
    priority: 2,
  },
  happy: {
    name: 'happy',
    sheetPath: happySheet,
    framePath: happyFrame,
    frameCount: 8,
    frameWidth: 256,
    frameHeight: 256,
    fps: 10,
    loop: true,
    priority: 2,
  },
  surprised: {
    name: 'surprised',
    sheetPath: surprisedSheet,
    framePath: surprisedFrame,
    frameCount: 8,
    frameWidth: 256,
    frameHeight: 256,
    fps: 8,
    loop: false,
    priority: 2,
  },
  clicked: {
    name: 'clicked',
    sheetPath: clickedSheet,
    framePath: clickedFrame,
    frameCount: 8,
    frameWidth: 256,
    frameHeight: 256,
    fps: 12,
    loop: false,
    priority: 3, // One-shot user click overrides lower states
  },
  sleeping: {
    name: 'sleeping',
    sheetPath: sleepingSheet,
    framePath: sleepingFrame,
    frameCount: 8,
    frameWidth: 256,
    frameHeight: 256,
    fps: 6,
    loop: true,
    priority: 1,
  },
};
