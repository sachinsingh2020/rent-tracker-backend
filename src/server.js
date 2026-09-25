const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Initialize DB connection in background
connectDB().catch(err => console.error('Initial DB connection error:', err.message));

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Ensure DB is connected for serverless invocations
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ error: 'Database connection failed: ' + err.message });
  }
});

// Root welcome route
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    app: 'Rent & Electricity Tracker API',
    database: 'MongoDB Atlas',
    healthCheck: '/api/health',
    timestamp: new Date().toISOString(),
  });
});

// Health Check Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'Rent & Electricity Tracker API',
    database: 'MongoDB Atlas',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/rooms', require('./routes/roomRoutes'));
app.use('/api/tenants', require('./routes/tenantRoutes'));
app.use('/api/bills', require('./routes/billRoutes'));
app.use('/api/settings', require('./routes/settingRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/sync', require('./routes/syncRoutes'));
app.all('/api/cleanup', require('./controllers/billController').cleanExpiredData);

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    requestedUrl: req.originalUrl,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;

// Only listen directly when not running in Vercel serverless environment
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT} (http://localhost:${PORT})`);
  });
}

module.exports = app;
