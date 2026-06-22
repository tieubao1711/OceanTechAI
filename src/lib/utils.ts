import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

/** Extract a stable feature slug from a discussion prompt or title. */
export function extractFeatureSlug(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("crew system")) return "crew-system";

  const systemMatch = text.match(/(\w+(?:\s+\w+)?)\s+system/i);
  if (systemMatch) return slugify(`${systemMatch[1]} system`);

  return slugify(text).slice(0, 50) || "feature";
}
