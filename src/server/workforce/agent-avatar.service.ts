import type { AvatarType } from "@prisma/client";

const AVATAR_EMOJIS: Record<AvatarType, string[]> = {
  PIXEL: ["👾", "🎮", "🕹️", "👻", "🤖", "💾", "🔋", "⚡"],
  CYBERPUNK: ["🦾", "🤖", "⚡", "🔮", "🌃", "💠", "🛸", "🔌"],
  FANTASY: ["🧙", "🧝", "🐉", "⚔️", "🛡️", "📜", "🔮", "🏰"],
  CORPORATE: ["👔", "💼", "📊", "🎯", "🏢", "📈", "🤝", "⭐"],
};

const AVATAR_COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444",
  "#06b6d4", "#ec4899", "#84cc16", "#6366f1", "#14b8a6",
];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function generateAvatarSeed(name: string, role: string): string {
  return `${name}-${role}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export class AgentAvatarService {
  resolve(seed: string, type: AvatarType = "CORPORATE") {
    const hash = hashString(`${type}:${seed}`);
    const emojis = AVATAR_EMOJIS[type];
    return {
      emoji: emojis[hash % emojis.length]!,
      color: AVATAR_COLORS[hash % AVATAR_COLORS.length]!,
      seed,
      type,
    };
  }
}

export const agentAvatarService = new AgentAvatarService();
