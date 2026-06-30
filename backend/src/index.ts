import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { createApp } from './app';
import { config } from './config';
import cron from 'node-cron';
import { runBlogDigestJob } from './digest/job';

const app = createApp();

app.listen(config.port, () => {
  console.log(`Backend running on http://localhost:${config.port}`);
});

cron.schedule('0 */4 * * *', () => {
  runBlogDigestJob().catch((err) => console.error('[digest] Job failed:', err));
});
