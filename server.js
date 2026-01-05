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

// -------- AI helpers (dev-only proxy) --------
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_CHAT_URL = process.env.OPENAI_CHAT_URL || 'https://api.openai.com/v1/chat/completions';

async function openaiChatJson({ system, user, temperature = 0.4 }) {
  if (!OPENAI_API_KEY) {
    const err = new Error('OPENAI_API_KEY is not set');
    err.statusCode = 501;
    throw err;
  }
  const payload = {
    model: OPENAI_MODEL,
    temperature,
    messages: [
      { role: 'system', content: String(system || '') },
      { role: 'user', content: String(user || '') },
    ],
  };
  const headers = {
    Authorization: `Bearer ${OPENAI_API_KEY}`,
  };
  return httpsJsonPost(OPENAI_CHAT_URL, headers, payload);
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function extractAssistantText(resp) {
  try {
    const choice = resp && resp.choices && resp.choices[0];
    const msg = choice && choice.message;
    return (msg && msg.content) ? String(msg.content) : '';
  } catch {
    return '';
  }
}

app.post('/ai/suggest-titles', async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim();
    const languageCode = String(req.body?.languageCode || '').trim();
    if (!title) return res.status(400).json({ error: 'title required' });

    const system = 'You are a helpful editor for a news app. Return ONLY valid JSON. No markdown.';
    const user = [
      `Input headline: "${title}"`,
      languageCode ? `Language code: ${languageCode} (write in this language).` : 'Write in the same language as the input.',
      'Task: Rewrite into 5 improved titles that are short, clear, and non-clickbait.',
      'Constraints: each title <= 60 characters. Return JSON array of 5 items: [{"title":"...","subtitle":"..."?}].',
      'If you add subtitle, keep it <= 80 characters. Subtitles are optional.',
    ].join('\n');

    const resp = await openaiChatJson({ system, user, temperature: 0.5 });
    const text = extractAssistantText(resp);
    const parsed = safeJsonParse(text);
    const suggestions = Array.isArray(parsed) ? parsed : (parsed && parsed.suggestions);
    if (!Array.isArray(suggestions)) return res.json({ suggestions: [] });
    const cleaned = suggestions
      .map((x) => ({
        title: String(x?.title || '').trim(),
        subtitle: x?.subtitle ? String(x.subtitle).trim() : undefined,
      }))
      .filter((x) => x.title)
      .slice(0, 5);
    return res.json({ suggestions: cleaned });
  } catch (e) {
    const status = e?.statusCode || 500;
    return res.status(status).json({ error: e?.message || 'AI suggest failed' });
  }
});

app.post('/ai/shorten-bullets', async (req, res) => {
  try {
    const bullets = Array.isArray(req.body?.bullets) ? req.body.bullets.map((b) => String(b || '').trim()).filter(Boolean) : [];
    const languageCode = String(req.body?.languageCode || '').trim();
    const maxChars = Number(req.body?.maxChars || 100);
    if (!bullets.length) return res.status(400).json({ error: 'bullets required' });

    const system = 'You are a concise news editor. Return ONLY valid JSON. No markdown.';
    const user = [
      languageCode ? `Language code: ${languageCode} (write in this language).` : 'Write in the same language as input bullets.',
      `Task: Rewrite each bullet to be <= ${maxChars} characters, preserving meaning.`,
      'Return JSON array of strings with SAME length and SAME order as input.',
      `Input bullets JSON: ${JSON.stringify(bullets)}`,
    ].join('\n');

    const resp = await openaiChatJson({ system, user, temperature: 0.2 });
    const text = extractAssistantText(resp);
    const parsed = safeJsonParse(text);
    const out = Array.isArray(parsed) ? parsed : (parsed && parsed.bullets);
    if (!Array.isArray(out)) return res.json({ bullets });
    const cleaned = out.map((x, idx) => String(x ?? bullets[idx] ?? '').trim()).filter(Boolean);
    return res.json({ bullets: cleaned.length ? cleaned : bullets });
  } catch (e) {
    const status = e?.statusCode || 500;
    return res.status(status).json({ error: e?.message || 'AI shorten failed' });
  }
});

app.post('/ai/translate', async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim();
    const to = String(req.body?.to || 'en').trim();
    if (!text) return res.status(400).json({ error: 'text required' });

    const system = 'You are a translation engine. Return ONLY valid JSON. No markdown.';
    const user = [
      `Translate the following text to ${to}.`,
      'Return JSON: {"text":"..."}.',
      `Text: ${JSON.stringify(text)}`,
    ].join('\n');

    const resp = await openaiChatJson({ system, user, temperature: 0.1 });
    const content = extractAssistantText(resp);
    const parsed = safeJsonParse(content);
    const out = String(parsed?.text || '').trim();
    return res.json({ text: out || text });
  } catch (e) {
    const status = e?.statusCode || 500;
    return res.status(status).json({ error: e?.message || 'AI translate failed' });
  }
});

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