// السماح بشهادات SSL الذاتية (مطلوب لـ Evolution API)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { initSocket } = require('./socket');
const { startCronJobs } = require('./services/cron.service');
const { initializeWhatsApp } = require('./services/whatsapp-init.service');

const app = express();
const server = http.createServer(app);
const io = initSocket(server);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/doctors', require('./routes/doctors'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/visits', require('./routes/visits'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/prescriptions', require('./routes/prescriptions'));
app.use('/api/followups', require('./routes/followups'));
app.use('/api/queue', require('./routes/queue'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/files', require('./routes/files'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/evolution', require('./routes/evolution'));
app.use('/api/whatsapp-requests', require('./routes/whatsappRequests'));
app.use('/api/external-orders', require('./routes/externalOrders'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'خطأ داخلي في الخادم' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🏥 Clinic Server running on http://localhost:${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
  startCronJobs();
  initializeWhatsApp();
});
