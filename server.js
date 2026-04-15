require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Rate Limiting (5 requests per 15 mins)
const SOS_LIMITER = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many SOS requests. Please wait." }
});

// Config
const SMS_GATEWAY_URL = process.env.SMS_GATEWAY_URL || 'http://YOUR_PHONE_IP:PORT/send';
const GUARDIAN_NUMBERS = process.env.GUARDIAN_PHONE_NUMBERS ? process.env.GUARDIAN_PHONE_NUMBERS.split(',') : [];

/**
 * Endpoint to serve frontend configuration (Firebase keys)
 */
app.get('/api/config', (req, res) => {
  res.json({
    firebaseConfig: {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
      measurementId: process.env.FIREBASE_MEASUREMENT_ID
    }
  });
});

/**
 * Endpoint to send SOS SMS via Android SMS Gateway
 * Expects: { latitude: Number, longitude: Number, area: String, message: String }
 */
app.post('/send-sos', SOS_LIMITER, async (req, res) => {
  const { latitude, longitude, area, message } = req.body;
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
  
  const smsBody = `
🚨 EMERGENCY SOS 🚨
Location: ${area || 'Unknown'}
Time: ${timestamp}
Note: ${message || 'Urgent help needed!'}
Live Map: ${mapsLink}
`.trim();

  try {
    console.log(`\n[SOS TRIGGERED] at ${timestamp}`);
    console.log(`[Message] Sending to ${GUARDIAN_NUMBERS.length} guardians...`);

    // Loop through guardians and send via Android Gateway
    const results = [];
    for (const number of GUARDIAN_NUMBERS) {
      const cleanNumber = number.trim();
      console.log(`[Gateway] Dispatching to ${cleanNumber}...`);

      try {
        const response = await fetch(SMS_GATEWAY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            number: cleanNumber,
            message: smsBody
          })
        });

        if (response.ok) {
          console.log(`✅ SMS successfully handed over to Android phone for ${cleanNumber}`);
          results.push({ number: cleanNumber, status: 'success' });
        } else {
          console.error(`❌ Gateway Error for ${cleanNumber}: ${response.statusText}`);
          results.push({ number: cleanNumber, status: 'failed' });
        }
      } catch (err) {
        console.error(`❌ Connection Error for ${cleanNumber}: ${err.message}`);
        results.push({ number: cleanNumber, status: 'error', error: err.message });
      }
    }

    res.status(200).json({ 
      success: true, 
      message: "Processing completed by backend.",
      results: results 
    });

  } catch (error) {
    console.error(`[Fatal Error] SOS Handler Failed:`, error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// Health Check
app.get('/', (req, res) => {
  res.send('Sentinel Safety Backend (Android Gateway Mode) is running.');
});

app.listen(PORT, () => {
  console.log(`-------------------------------------------`);
  console.log(`🚀 Sentinel Backend (Android Gateway) Live`);
  console.log(`📍 Gateway URL: ${SMS_GATEWAY_URL}`);
  console.log(`🚨 Registered Guardians: ${GUARDIAN_NUMBERS.length}`);
  console.log(`-------------------------------------------`);
});
