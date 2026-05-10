import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tiny class-name helper used by every cockpit component. Clsx handles the
 * boolean/object syntax, twMerge dedups conflicting Tailwind classes (so
 * `cn("p-2", "p-4")` resolves to "p-4").
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
