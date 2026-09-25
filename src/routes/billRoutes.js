const express = require('express');
const router = express.Router();
const {
  createBill,
  updatePaymentStatus,
  deleteBill,
  cleanExpiredData,
} = require('../controllers/billController');
const { optionalAuth } = require('../middleware/auth');

router.use(optionalAuth);

router.post('/', createBill);
router.all('/cleanup', cleanExpiredData);
router.patch('/:id/payment', updatePaymentStatus);
router.delete('/:id', deleteBill);

module.exports = router;
