const express = require('express');
const router = express.Router();
const {
  getTenants,
  getTenantById,
  createTenant,
  updateTenant,
  vacateTenant,
} = require('../controllers/tenantController');
const { optionalAuth } = require('../middleware/auth');

router.use(optionalAuth);

router.route('/').get(getTenants).post(createTenant);
router.route('/:id').get(getTenantById).put(updateTenant);
router.route('/:id/vacate').post(vacateTenant);

module.exports = router;
