const crypto = require('crypto');

// Secret key for HMAC signing (In production, stored in Firebase Secret Manager)
const HMAC_SECRET = process.env.QR_HMAC_SECRET || 'eventpulse-secure-qr-secret-key-2026';
const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes validity window

/**
 * Generate a cryptographically signed QR token for a registration
 */
function createQRToken(eventId, userId) {
  const timestamp = Date.now();
  const payload = `${eventId}:${userId}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', HMAC_SECRET);
  hmac.update(payload);
  const signature = hmac.digest('hex');

  // Token format: base64(payload:signature)
  const fullToken = `${payload}:${signature}`;
  return Buffer.from(fullToken).toString('base64');
}

/**
 * Verify signature and expiration of a QR token
 */
function verifyQRToken(tokenString) {
  try {
    const raw = Buffer.from(tokenString, 'base64').toString('utf-8');
    const parts = raw.split(':');
    if (parts.length !== 4) {
      return { valid: false, reason: 'Malformed token structure' };
    }

    const [eventId, userId, timestampStr, signature] = parts;
    const timestamp = parseInt(timestampStr, 10);

    if (isNaN(timestamp)) {
      return { valid: false, reason: 'Invalid token timestamp' };
    }

    // Check expiration
    const now = Date.now();
    if (now - timestamp > TOKEN_TTL_MS) {
      return { valid: false, reason: 'QR token has expired. Please refresh your pass.' };
    }

    // Re-compute signature
    const payload = `${eventId}:${userId}:${timestampStr}`;
    const hmac = crypto.createHmac('sha256', HMAC_SECRET);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return { valid: true, eventId, userId, timestamp };
    } else {
      return { valid: false, reason: 'Tampered or invalid QR signature' };
    }
  } catch (err) {
    return { valid: false, reason: `Token decode error: ${err.message}` };
  }
}

module.exports = {
  createQRToken,
  verifyQRToken
};
