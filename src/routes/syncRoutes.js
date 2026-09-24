const express = require('express');
const router = express.Router();
const { syncOfflineData } = require('../controllers/syncController');
const { optionalAuth } = require('../middleware/auth');

router.post('/', optionalAuth, syncOfflineData);

module.exports = router;
