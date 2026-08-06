// src/index.ts
import app from './app';
import dotenv from 'dotenv';
dotenv.config();

import { runStartupSync } from './startup';

const PORT = process.env.PORT || 4000;

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await runStartupSync();
});
