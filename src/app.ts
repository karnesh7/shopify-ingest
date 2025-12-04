// src/app.ts
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import tenantRouter from './routes/tenants';

const app = express();
app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/tenants', tenantRouter);

export default app;
