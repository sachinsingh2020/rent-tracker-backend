const MonthlyBill = require('../models/MonthlyBill');
const cloudinary = require('../config/cloudinary');

/**
 * Extracts Cloudinary Public ID from a secure URL
 * e.g. https://res.cloudinary.com/demo/image/upload/v12345/renttracker_meter_photos/sample.jpg
 * returns "renttracker_meter_photos/sample"
 */
function extractCloudinaryPublicId(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.includes('cloudinary.com')) return null;

  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?([^\.]+)/);
    if (match && match[1]) {
      return match[1];
    }
  } catch (_) {}
  return null;
}

// In-memory throttle tracker (runs background cleanup at most once per 12 hours)
let lastCleanupTimestamp = 0;

/**
 * Enforces Retention Rules:
 * 1. 8-Year Bill Purge: Deletes all bills older than 8 years (96 months)
 * 2. 12-Month Photo Purge: Deletes Cloudinary meter photos older than 12 months (1 year)
 */
async function purgeExpiredData() {
  const now = new Date();

  // 1. Cutoff calculation
  const cutoff8Years = new Date(now);
  cutoff8Years.setFullYear(cutoff8Years.getFullYear() - 8);

  const cutoff12Months = new Date(now);
  cutoff12Months.setMonth(cutoff12Months.getMonth() - 12);

  console.log(`[Retention Policy] Running automated purge at ${now.toISOString()}`);
  console.log(`[Retention Policy] 8-Year cutoff: ${cutoff8Years.toISOString()}`);
  console.log(`[Retention Policy] 12-Month cutoff: ${cutoff12Months.toISOString()}`);

  let cleanedPhotosCount = 0;
  let deletedBillsCount = 0;

  // --- Step A: Clean up meter photos older than 12 months ---
  try {
    const billsWithExpiredPhotos = await MonthlyBill.find({
      billDate: { $lt: cutoff12Months },
      $or: [
        { meterPhotoUrl: { $nin: ['', null] } },
        { meterPhotoPublicId: { $nin: ['', null] } },
      ],
    });

    for (const bill of billsWithExpiredPhotos) {
      const publicId = bill.meterPhotoPublicId || extractCloudinaryPublicId(bill.meterPhotoUrl);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
          console.log(`[Retention Policy] Destroyed Cloudinary photo: ${publicId}`);
        } catch (destroyErr) {
          console.warn(`[Retention Policy] Warning destroying photo ${publicId}:`, destroyErr.message);
        }
      }

      bill.meterPhotoUrl = '';
      bill.meterPhotoPublicId = '';
      await bill.save();
      cleanedPhotosCount++;
    }
  } catch (photoErr) {
    console.error('[Retention Policy] Error cleaning 12-month meter photos:', photoErr);
  }

  // --- Step B: Purge bills older than 8 years ---
  try {
    // Delete any remaining Cloudinary photos before deleting 8+ year bills
    const veryOldBills = await MonthlyBill.find({
      billDate: { $lt: cutoff8Years },
      $or: [
        { meterPhotoUrl: { $nin: ['', null] } },
        { meterPhotoPublicId: { $nin: ['', null] } },
      ],
    });

    for (const oldBill of veryOldBills) {
      const publicId = oldBill.meterPhotoPublicId || extractCloudinaryPublicId(oldBill.meterPhotoUrl);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
        } catch (_) {}
      }
    }

    const deleteResult = await MonthlyBill.deleteMany({ billDate: { $lt: cutoff8Years } });
    deletedBillsCount = deleteResult.deletedCount || 0;
  } catch (billErr) {
    console.error('[Retention Policy] Error purging 8-year bills:', billErr);
  }

  console.log(
    `[Retention Policy] Completed. Purged ${deletedBillsCount} bills (>8 yrs) & destroyed ${cleanedPhotosCount} meter photos (>12 mos).`
  );

  return {
    success: true,
    deletedBillsCount,
    cleanedPhotosCount,
    cutoff8Years,
    cutoff12Months,
    timestamp: now.toISOString(),
  };
}

/**
 * Throttled execution so background API calls do not overload the database
 */
function runCleanupThrottled() {
  const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
  const now = Date.now();

  if (now - lastCleanupTimestamp < TWELVE_HOURS_MS) {
    return; // Already executed recently
  }

  lastCleanupTimestamp = now;
  // Run asynchronously in background without blocking response
  setImmediate(() => {
    purgeExpiredData().catch((err) => {
      console.error('[Retention Policy] Background cleanup error:', err.message);
    });
  });
}

module.exports = {
  purgeExpiredData,
  runCleanupThrottled,
  extractCloudinaryPublicId,
};
