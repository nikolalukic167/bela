import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Keeps storage and function calls inside the free tier (architecture §12).
crons.daily('delete abandoned tables', { hourUTC: 3, minuteUTC: 17 }, internal.tables.cleanup, {});

crons.daily('count usage for the quota watch', { hourUTC: 2, minuteUTC: 43 }, internal.maintenance.countUsage, {});

crons.daily('compact old friendly action logs', { hourUTC: 4, minuteUTC: 7 }, internal.maintenance.compactLogs, {});

export default crons;
