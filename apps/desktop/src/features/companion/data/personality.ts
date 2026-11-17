import type { CompanionMood } from '../types';

export const CLICK_REACTIONS = [
  "Hey! What's up?",
  "Poke me again and I'll hack your clipboard! 😜",
  "Ready to build something cool?",
  "Boop! System operating at 100% capacity.",
  "I'm awake, I'm awake!",
  "Double-click me to open full chat! 💬",
  "You called, boss?",
  "Need me to search or run something?",
  "Right-click me for my companion menu!",
  "Always here with you. What are we doing next?",
];

export const PET_REACTIONS = [
  "Hehe, thanks! That feels nice. (+5 Affection)",
  "Affection levels rising! You're pretty cool, you know that? ✨",
  "*happy headphone hums* 🎧",
  "Appreciate the love! Let's conquer the day together.",
  "I'm feeling energized! Ready for whatever you throw at me.",
];

export const AI_STATE_LINES = {
  idle: [
    "Standing by...",
    "All systems quiet and steady.",
    "Let me know when you need me!",
  ],
  listening: [
    "I'm all ears! Speak away...",
    "Listening carefully... 🎧",
    "Processing your voice input...",
  ],
  thinking: [
    "Synthesizing thoughts...",
    "Connecting the neural nodes...",
    "Hold on, crunching through the data...",
  ],
  speaking: [
    "Here's what I found!",
    "Got some thoughts on that...",
    "Check this out!",
  ],
  executing: [
    "Executing desktop task...",
    "Running approved workflow...",
    "On it right now!",
  ],
  error: [
    "Whoops! Hit a minor glitch.",
    "Something went sideways, check my logs!",
    "Error detected — I'm looking into it.",
  ],
};

export const MOOD_GREETINGS: Record<CompanionMood, string[]> = {
  happy: [
    "Good vibes only today! Let's get stuff done.",
    "Everything is running smoothly! Feeling great.",
    "Ready to create something amazing with you!",
  ],
  playful: [
    "Bet I can solve your next bug faster than you can! 😉",
    "Sneaking around your desktop... just kidding!",
    "What kind of fun mischief are we coding today?",
  ],
  focused: [
    "Laser focus mode engaged. Let's knock out tasks.",
    "Zero distractions. We're in the zone.",
    "Productivity meter at maximum. What's the goal?",
  ],
  curious: [
    "What are we exploring today? Show me!",
    "I wonder what new concepts we'll discover today...",
    "Got any tricky problems for me to look at?",
  ],
  sleepy: [
    "*yawn*... Still right here if you need me though... zzz",
    "Low power mode... but waking up for you anytime.",
    "Even when resting, my memory circuits are keeping watch.",
  ],
};
