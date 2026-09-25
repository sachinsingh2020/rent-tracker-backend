const express = require('express');
const router = express.Router();
const { syncOfflineData, getSyncStatus, getExportData } = require('../controllers/syncController');
const { optionalAuth } = require('../middleware/auth');

router.post('/', optionalAuth, syncOfflineData);
router.get('/status', optionalAuth, getSyncStatus);
router.get('/export', optionalAuth, getExportData);

module.exports = router;
