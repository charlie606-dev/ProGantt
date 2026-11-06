import {
  format, eachDayOfInterval, startOfDay, eachWeekOfInterval, eachMonthOfInterval, eachQuarterOfInterval, eachYearOfInterval,
  isSameDay, differenceInDays, addDays, min, max, isWeekend,
  startOfWeek, startOfMonth, startOfYear, startOfQuarter,
  endOfWeek, endOfMonth, endOfYear, endOfQuarter
} from 'date-fns';
import { TimelineViewMode } from '../types';

export interface TimelineHeaderCell {
  key: string;
  label: string;
  subLabel?: string;
  date?: Date;
  daysCount: number;
  isWeekend?: boolean;
  isToday?: boolean;
}

export interface TimelineHeaders {
  topHeader: TimelineHeaderCell[];
  bottomHeader: TimelineHeaderCell[];
}

/** Pixel width of one day for each timeline zoom level. */
export const getCellWidth = (viewMode: TimelineViewMode): number => {
  switch (viewMode) {
    case 'year': return 1.2;    // ~36px per month
    case 'quarter': return 1.5; // ~45px per month
    case 'month': return 5;     // 35px per week
    case 'week': return 10;
    case 'day':
    default: return 40;
  }
};

/**
 * Two-tier timeline headers:
 * - day:     month / day
 * - week:    month / week
 * - month:   month / week
 * - quarter: quarter / month
 * - year:    year / month
 */
export const buildTimelineHeaders = (
  viewMode: TimelineViewMode,
  projectStart: Date,
  projectEnd: Date,
  days: Date[]
): TimelineHeaders => {
  if (days.length === 0) return { topHeader: [], bottomHeader: [] };

  const interval = { start: projectStart, end: projectEnd };
  const getDays = (start: Date, end: Date) => {
    const s = max([start, projectStart]);
    const e = min([end, projectEnd]);
    return Math.max(0, differenceInDays(addDays(e, 1), s));
  };

  const monthCells = (labelFormat: string) =>
    eachMonthOfInterval(interval).map(m => ({
      key: m.toISOString(),
      label: format(m, labelFormat),
      date: m,
      daysCount: getDays(startOfMonth(m), endOfMonth(m))
    }));

  const weekCells = (labelPrefix: string) =>
    eachWeekOfInterval(interval, { weekStartsOn: 1 }).map(w => ({
      key: w.toISOString(),
      label: `${labelPrefix}${format(w, 'w')}`,
      date: w,
      daysCount: getDays(startOfWeek(w, { weekStartsOn: 1 }), endOfWeek(w, { weekStartsOn: 1 }))
    }));

  switch (viewMode) {
    case 'year': {
      const top = eachYearOfInterval(interval).map(y => ({
        key: y.toISOString(),
        label: format(y, 'yyyy年'),
        date: y,
        daysCount: getDays(startOfYear(y), endOfYear(y))
      }));
      return { topHeader: top, bottomHeader: monthCells('M月') };
    }
    case 'quarter': {
      const top = eachQuarterOfInterval(interval).map(q => ({
        key: q.toISOString(),
        label: `${format(q, 'yyyy')} Q${format(q, 'Q')}`,
        date: q,
        daysCount: getDays(startOfQuarter(q), endOfQuarter(q))
      }));
      return { topHeader: top, bottomHeader: monthCells('M月') };
    }
    case 'month':
      return { topHeader: monthCells('yyyy年 M月'), bottomHeader: weekCells('W') };
    case 'week':
      return { topHeader: monthCells('yyyy MMM'), bottomHeader: weekCells('Week ') };
    case 'day':
    default: {
      const today = new Date();
      const bottom = days.map(d => ({
        key: d.toISOString(),
        label: format(d, 'd'),
        subLabel: format(d, 'EEE'),
        date: d,
        daysCount: 1,
        isWeekend: isWeekend(d),
        isToday: isSameDay(d, today)
      }));
      return { topHeader: monthCells('yyyy年 MM月'), bottomHeader: bottom };
    }
  }
};

/**
 * Snap the visible range to whole header units so the timeline never starts
 * or ends with a clipped week / month / quarter / year.
 */
export const buildTimelineRange = (viewMode: TimelineViewMode, start: Date, end: Date) => {
  const weekOpts = { weekStartsOn: 1 as const };
  let s = startOfDay(start);
  let e = startOfDay(end);
  switch (viewMode) {
    case 'week':
      s = startOfWeek(s, weekOpts);
      e = endOfWeek(e, weekOpts);
      break;
    case 'month':
      // whole months, extended so the first/last weeks are complete too
      s = startOfWeek(startOfMonth(s), weekOpts);
      e = endOfWeek(endOfMonth(e), weekOpts);
      break;
    case 'quarter':
      s = startOfQuarter(s);
      e = endOfQuarter(e);
      break;
    case 'year':
      s = startOfYear(s);
      e = endOfYear(e);
      break;
  }
  const projectStart = startOfDay(s);
  const projectEnd = startOfDay(e);
  const days = eachDayOfInterval({ start: projectStart, end: projectEnd });
  return { days, projectStart, projectEnd };
};

/** Rough check whether a header label fits in a cell of the given pixel width. */
export const labelFits = (label: string, width: number): boolean => {
  let w = 4; // horizontal padding
  for (const ch of label) w += /[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? 12 : 7;
  return width >= w;
};
