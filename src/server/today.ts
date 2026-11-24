import { createServerFn } from '@tanstack/react-start'
import { todayIn } from '@/lib/dates'
import { familyMiddleware } from './family'
import { buildToday } from './today.server'

export type {
  TodayChild,
  TodayHabit,
  TodayReview,
  TodaySuggestion,
} from './today.server'

export const getToday = createServerFn({ method: 'GET' })
  .middleware([familyMiddleware])
  .handler(async ({ context }) => {
    const today = todayIn(context.timezone)
    return { today, children: await buildToday(context.familyId, today) }
  })
