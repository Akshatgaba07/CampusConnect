const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');
const { general } = require('./middleware/rateLimit');

const app = express();
app.set('trust proxy', 1); // behind NGINX: real client IP for rate limits and audit logs
app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: '50kb' }));
app.use('/api', general, routes);
app.use(notFound);
app.use(errorHandler);
module.exports = app;
