require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// API routes
app.use('/api/settings',  require('./routes/settings'));
app.use('/api/po',        require('./routes/po'));
app.use('/api/cpi',       require('./routes/cpi'));
app.use('/api/mapping',   require('./routes/mapping'));
app.use('/api/ui-config', require('./routes/ui-config'));
app.use('/api/status',    require('./routes/status'));
app.use('/api/systems',   require('./routes/systems'));

// Serve React build in production
const clientDist = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

(async () => {
  try {
    await initDb();
    console.log('Database initialised.');
  } catch (err) {
    console.error('DB init failed:', err.message);
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`PI/CPI Switch Panel running at http://localhost:${PORT}`);
    console.log('  Development mode: start client with "npm run dev:client"');
  });
})();
