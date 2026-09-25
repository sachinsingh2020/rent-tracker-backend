const express = require('express');
const router = express.Router();
const {
  createBill,
  updatePaymentStatus,
  deleteBill,
  cleanExpiredData,
} = require('../controllers/billController');

router.post('/', createBill);
router.all('/cleanup', cleanExpiredData);
router.patch('/:id/payment', updatePaymentStatus);
router.delete('/:id', deleteBill);

module.exports = router;
