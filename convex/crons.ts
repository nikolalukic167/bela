import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Keeps storage and function calls inside the free tier (architecture §12).
crons.daily('delete abandoned tables', { hourUTC: 3, minuteUTC: 17 }, internal.tables.cleanup, {});

export default crons;
