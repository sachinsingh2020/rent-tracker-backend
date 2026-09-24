const express = require('express');
const router = express.Router();
const {
  getTenants,
  getTenantById,
  createTenant,
  updateTenant,
  vacateTenant,
} = require('../controllers/tenantController');

router.route('/').get(getTenants).post(createTenant);
router.route('/:id').get(getTenantById).put(updateTenant);
router.route('/:id/vacate').post(vacateTenant);

module.exports = router;
