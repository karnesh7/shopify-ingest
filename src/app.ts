// src/app.ts
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import tenantRouter from './routes/tenants';
import dataRouter from './routes/data';
import shopifyRouter from './routes/shopify';
import insightsRouter from './routes/insights';

const app = express();
app.use(helmet());
app.use(morgan('dev'));

// capture raw body for webhook verification
app.use((req, res, next) => {
  if (req.path === '/shopify/webhook') {
    // collect raw body buffer
    let data = Buffer.alloc(0);
    req.on('data', (chunk: Buffer) => {
      data = Buffer.concat([data, chunk]);
    });
    req.on('end', () => {
      (req as any).rawBody = data;
      try {
        // do NOT parse here - the webhook handler will parse rawBody
        next();
      } catch (err) {
        next(err);
      }
    });
  } else {
    express.json()(req, res, next);
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/tenants', tenantRouter);
app.use('/api/data', dataRouter);
app.use('/shopify', shopifyRouter);
app.use('/api/insights', insightsRouter);

export default app;