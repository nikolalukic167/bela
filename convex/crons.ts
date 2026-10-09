import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Keeps storage and function calls inside the free tier (architecture §12).
crons.daily('delete abandoned tables', { hourUTC: 3, minuteUTC: 17 }, internal.tables.cleanup, {});
// Chat entries expire after CHAT_TTL_MS; the query hides them, this deletes them.
crons.hourly('purge expired chat', { minuteUTC: 41 }, internal.chat.purge, {});

export default crons;
