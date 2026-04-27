import { eachDayOfInterval, isWeekend, isBefore, format, parseISO } from 'date-fns';

export interface UserProfile {
  uid: string;
  name: string;
  role: string;
  department?: string;
  startDate?: string;
  createdAt?: string;
}

export interface DTRLog {
  id: string;
  userId: string;
  date: string;
  timeIn?: string;
  timeOut?: string;
  totalHours?: number;
  status?: string;
  activities?: string;
}

/**
 * Given a list of exact logs for a specific user, generate "absent" logs for any missing days
 * between the given start date and end date (or today, whichever is earlier), excluding weekends.
 * It also respects the user's `startDate` or `createdAt` to avoid marking them absent before they were hired.
 */
export function fillMissingDaysForUser(
  userLogs: DTRLog[],
  user: Partial<UserProfile>,
  intervalStart: Date,
  intervalEnd: Date
): DTRLog[] {
  if (!user || !user.uid) return userLogs;

  const presentDates = new Set(userLogs.map(log => log.date));
  const missingLogs: DTRLog[] = [];
  
  const today = new Date();
  // Don't calculate for future dates
  const effectiveEnd = isBefore(intervalEnd, today) ? intervalEnd : today;

  let effectiveStart = intervalStart;

  // Determine the earliest date the user was active
  const userStartDateStr = user.startDate || user.createdAt;
  if (userStartDateStr) {
    let dateObj;
    // Handle both 'YYYY-MM-DD' and ISO string formats
    if (userStartDateStr.includes('T')) {
      dateObj = parseISO(userStartDateStr);
    } else {
      dateObj = new Date(userStartDateStr);
    }
    
    // Validate parsing
    if (!isNaN(dateObj.getTime()) && isBefore(effectiveStart, dateObj)) {
      effectiveStart = dateObj;
    }
  }

  // If start is after end, there's no interval
  if (isBefore(effectiveEnd, effectiveStart)) {
    return userLogs;
  }

  const days = eachDayOfInterval({ start: effectiveStart, end: effectiveEnd });

  for (const day of days) {
    if (isWeekend(day)) continue; // Exclude weekends

    const dateStr = format(day, 'yyyy-MM-dd');
    if (!presentDates.has(dateStr)) {
      missingLogs.push({
        id: `virtual-absent-${user.uid}-${dateStr}`,
        userId: user.uid,
        date: dateStr,
        timeIn: '',
        timeOut: '',
        totalHours: 0,
        status: 'absent',
        activities: 'Absent (System Generated)'
      });
    }
  }

  const combined = [...userLogs, ...missingLogs];
  // Sort descending by date
  combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return combined;
}

/**
 * Given a bunch of users and all their logs, inject missing days for each user within the specified interval.
 */
export function fillMissingDaysForAllUsers(
  allLogs: DTRLog[],
  users: UserProfile[],
  intervalStart: Date,
  intervalEnd: Date
): DTRLog[] {
  const finalLogs: DTRLog[] = [];
  
  for (const user of users) {
    const userLogs = allLogs.filter(log => log.userId === user.uid);
    const filled = fillMissingDaysForUser(userLogs, user, intervalStart, intervalEnd);
    finalLogs.push(...filled);
  }

  // Sort descending overall
  finalLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return finalLogs;
}
