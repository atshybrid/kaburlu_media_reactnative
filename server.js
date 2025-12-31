// server.js (minimal - do not use in production as-is)
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const https = require('https');
const admin = require('firebase-admin');

const app = express();
app.use(bodyParser.json());

const JWT_SECRET = 'very-secret-key-change-me';
const REFRESH_STORE = {}; // in-memory map refreshToken -> { deviceId, expiresAt }
const DEV_STORE = {}; // deviceId -> { languageId }
const COMMENTS = {}; // articleId -> [ { id, user, text, createdAt, likes, replies: [] } ]
const USERS = {}; // userId -> { id, name, email, phoneNumber, userType, createdAt }
const MPIN_STORE = {}; // phoneNumber -> { mpin, attempts, lockedUntil, userId }

// OTP store: phone -> { otpHash, purpose, expiresAt, attempts }
const OTP_STORE = new Map();
const OTP_TTL_MINUTES = Number.parseInt(process.env.WHATSAPP_OTP_TTL_MINUTES || '10', 10);
const OTP_MAX_ATTEMPTS = Number.parseInt(process.env.WHATSAPP_OTP_MAX_ATTEMPTS || '5', 10);

function normalizePhoneE164Digits(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits;
}

function randomOtp6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function httpsJsonPost(url, headers, payload) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(payload);

    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        path: `${u.pathname}${u.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers,
        },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          const ok = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
          let parsed;
          try {
            parsed = body ? JSON.parse(body) : {};
          } catch {
            parsed = { raw: body };
          }
          if (!ok) {
            const err = new Error(`HTTP ${res.statusCode} ${res.statusMessage}`);
            err.statusCode = res.statusCode;
            err.response = parsed;
            return reject(err);
          }
          resolve(parsed);
        });
      }
    );

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function sendWhatsAppOtpTemplate({ to, otp, purpose }) {
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v22.0';
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'kaburlu_app_otp';
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || 'en_US';
  const supportPhone = String(process.env.WHATSAPP_SUPPORT_PHONE || '1234567890').slice(0, 15);
  const validityText = process.env.WHATSAPP_OTP_VALIDITY_TEXT || `${OTP_TTL_MINUTES} minutes`;

  if (!phoneNumberId || !accessToken) {
    throw new Error('WhatsApp env missing: WHATSAPP_PHONE_NUMBER_ID and/or WHATSAPP_ACCESS_TOKEN');
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: templateLang },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: String(otp) },
            { type: 'text', text: String(purpose) },
            { type: 'text', text: String(validityText) },
            { type: 'text', text: String(supportPhone) },
          ],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: String(otp) }],
        },
      ],
    },
  };

  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  return httpsJsonPost(url, headers, payload);
}

app.get('/languages', (req, res) => {
  res.json([{ id: 'te', name: 'Telugu' }, { id: 'en', name: 'English' }, { id: 'hi', name: 'Hindi' }]);
});

app.post('/devices', (req, res) => {
  const { deviceId, languageId, platform, deviceMake, deviceModel } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
  DEV_STORE[deviceId] = { languageId, platform, deviceMake, deviceModel };
  return res.status(201).json({ success: true, deviceId });
});

app.post('/auth/guest', (req, res) => {
  const { deviceId, languageId } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

  // create JWT
  const token = jwt.sign({ sub: deviceId, type: 'guest', languageId }, JWT_SECRET, { expiresIn: '30d' });
  const refresh = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30*24*3600*1000).toISOString();
  REFRESH_STORE[refresh] = { deviceId, expiresAt };
  res.status(201).json({ token, refreshToken: refresh, expiresAt, userType: 'guest', deviceId });
});

app.post('/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  const r = REFRESH_STORE[refreshToken];
  if (!r) return res.status(401).json({ error: 'invalid refresh' });
  // rotate
  delete REFRESH_STORE[refreshToken];
  const token = jwt.sign({ sub: r.deviceId, type: 'guest' }, JWT_SECRET, { expiresIn: '30d' });
  const newRefresh = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30*24*3600*1000).toISOString();
  REFRESH_STORE[newRefresh] = { deviceId: r.deviceId, expiresAt };
  res.json({ token, refreshToken: newRefresh, expiresAt });
});

app.post('/fcm/register', (req, res) => {
  const { deviceId, fcmToken } = req.body;
  // store mapping in DB
  console.log('register fcm', deviceId, fcmToken);
  res.status(201).json({ success: true });
});

app.post('/location', (req, res) => {
  const { deviceId, lat, lng } = req.body;
  console.log('loc', deviceId, lat, lng);
  res.status(201).json({ success: true });
});

app.get('/news', (req, res) => {
  const sample = [{ id: 'a1', title: 'Farmers Celebrate Irrigation Success', summary: 'First 60 words ...', body: 'Full body', image: null, author: { name: 'Ravi' }, createdAt: new Date().toISOString(), isRead: false }];
  res.json({ page: 1, pageSize: 10, total: 1, data: sample });
});

// Comments API (demo only; in-memory)
app.get('/comments', (req, res) => {
  const { articleId } = req.query;
  if (!articleId) return res.status(400).json({ error: 'articleId required' });
  const data = COMMENTS[articleId] || [];
  res.json({ data });
});

app.post('/comments', (req, res) => {
  const { articleId, text, parentId, user } = req.body;
  if (!articleId || !text) return res.status(400).json({ error: 'articleId and text required' });
  const newNode = {
    id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex'),
    user: user || { id: 'guest', name: 'Guest', avatar: 'https://i.pravatar.cc/100' },
    text,
    createdAt: new Date().toISOString(),
    likes: 0,
    replies: [],
  };
  COMMENTS[articleId] = COMMENTS[articleId] || [];
  const insert = (list, pid) => {
    for (const item of list) {
      if (item.id === pid) {
        item.replies = item.replies || [];
        item.replies.push(newNode);
        return true;
      }
      if (item.replies && insert(item.replies, pid)) return true;
    }
    return false;
  };
  if (parentId) {
    const ok = insert(COMMENTS[articleId], parentId);
    if (!ok) return res.status(404).json({ error: 'parentId not found' });
  } else {
    COMMENTS[articleId].unshift(newNode);
  }
  res.status(201).json({ data: newNode });
});

// WhatsApp OTP (demo only; in-memory)
app.post('/api/otp/request', async (req, res) => {
  try {
    const phone = normalizePhoneE164Digits(req.body?.phone);
    const purpose = String(req.body?.purpose || 'reset');

    if (!phone) return res.status(400).json({ error: 'phone required' });
    if (phone.length < 8 || phone.length > 15) return res.status(400).json({ error: 'phone must be E.164 digits (8-15)' });

    const otp = randomOtp6();
    const expiresAt = Date.now() + OTP_TTL_MINUTES * 60 * 1000;
    const otpHash = sha256Hex(`${phone}:${otp}`);
    OTP_STORE.set(phone, { otpHash, purpose, expiresAt, attempts: 0 });

    const wa = await sendWhatsAppOtpTemplate({ to: phone, otp, purpose });
    return res.status(200).json({ success: true, expiresInSeconds: OTP_TTL_MINUTES * 60, whatsapp: wa });
  } catch (err) {
    console.error(err.response || err.message);
    return res.status(500).json({ success: false, error: 'Failed to send OTP' });
  }
});

app.post('/api/otp/verify', (req, res) => {
  const phone = normalizePhoneE164Digits(req.body?.phone);
  const otp = String(req.body?.otp || '');
  const purpose = req.body?.purpose ? String(req.body?.purpose) : undefined;

  if (!phone || !otp) return res.status(400).json({ error: 'phone and otp are required' });

  const entry = OTP_STORE.get(phone);
  if (!entry) return res.status(400).json({ success: false, error: 'OTP not found' });
  if (purpose && entry.purpose !== purpose) return res.status(400).json({ success: false, error: 'OTP purpose mismatch' });
  if (Date.now() > entry.expiresAt) {
    OTP_STORE.delete(phone);
    return res.status(400).json({ success: false, error: 'OTP expired' });
  }
  if (entry.attempts >= OTP_MAX_ATTEMPTS) {
    OTP_STORE.delete(phone);
    return res.status(429).json({ success: false, error: 'Too many attempts' });
  }

  entry.attempts += 1;
  const expected = entry.otpHash;
  const actual = sha256Hex(`${phone}:${otp}`);
  const ok = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));

  if (!ok) return res.status(400).json({ success: false, error: 'Invalid OTP' });

  OTP_STORE.delete(phone);
  return res.json({ success: true });
});

// Backward-compatible endpoint (matches your pasted example)
app.post('/api/send-otp', async (req, res) => {
  try {
    const phone = normalizePhoneE164Digits(req.body?.phone);
    const otp = String(req.body?.otp || '');
    const purpose = String(req.body?.purpose || 'login');

    if (!phone || !otp || !purpose) {
      return res.status(400).json({ error: 'phone, otp, purpose are required' });
    }
    if (phone.length < 8 || phone.length > 15) return res.status(400).json({ error: 'phone must be E.164 digits (8-15)' });

    const wa = await sendWhatsAppOtpTemplate({ to: phone, otp, purpose });
    return res.json({ success: true, message: 'OTP sent (accepted by WhatsApp)', data: wa });
  } catch (err) {
    console.error(err.response || err.message);
    return res.status(500).json({ success: false, error: 'Failed to send OTP' });
  }
});

app.listen(3000, () => console.log('API running on http://localhost:3000'));