const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingController');
const { optionalAuth } = require('../middleware/auth');

router.use(optionalAuth);

router.route('/').get(getSettings).put(updateSettings);

module.exports = router;
