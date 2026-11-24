/**
 * Nilai enum domain. Tanpa dependency drizzle supaya aman di-import client.
 */

export const STRUCTURES = ['range', 'checklist', 'none'] as const
export type Structure = (typeof STRUCTURES)[number]

export const MASTERY_LEVELS = ['belum', 'kenal', 'bisa', 'mahir'] as const
export type MasteryLevel = (typeof MASTERY_LEVELS)[number]

export const SUGGEST_ORDERS = ['asc', 'desc', 'manual'] as const
export type SuggestOrder = (typeof SUGGEST_ORDERS)[number]
