const express = require('express');
const router = express.Router();
const {
  createBill,
  updatePaymentStatus,
  deleteBill,
} = require('../controllers/billController');

router.post('/', createBill);
router.patch('/:id/payment', updatePaymentStatus);
router.delete('/:id', deleteBill);

module.exports = router;
