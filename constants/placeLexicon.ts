// Simple Telugu place name lexicon for common cities/districts/states
// Note: keys are normalized to lowercase without extra spaces

const TELUGU_PLACES: Record<string, string> = {
  'hyderabad': 'హైదరాబాదు',
  'hyderabad district': 'హైదరాబాద్ జిల్లా',
  'secunderabad': 'సికింద్రాబాద్',
  'warangal': 'వరంగల్',
  'nizamabad': 'నిజామాబాద్',
  'adilabad': 'ఆదిలాబాద్',
  'karimnagar': 'కరీంనగర్',
  'khammam': 'ఖమ్మం',
  'medak': 'మెదక్',
  'mahabubnagar': 'మహబూబ్‌నగర్',
  'rangareddy': 'రంగారెడ్డి',
  'rangareddy district': 'రంగారెడ్డి జిల్లా',
  'telangana': 'తెలంగాణ',
  'andhra pradesh': 'ఆంధ్ర ప్రదేశ్',
  'visakhapatnam': 'విశాఖపట్నం',
  'vizag': 'విషాఖపట్నం',
  'vijayawada': 'విజయవాడ',
  'guntur': 'గుంటూరు',
  'nellore': 'నెల్లూరు',
  'tirupati': 'తిరుపతి',
  'rajahmundry': 'రాజమండ్రి',
  'kakinada': 'కాకినాడ',
  'eluru': 'ఏలూరు',
  'srikakulam': 'శ్రీకాకుళం',
  'ongole': 'ఒంగోలు',
  'chittoor': 'చిత్తూరు',
  'kadapa': 'కడప',
  'kurnool': 'కర్నూలు',
  'anantapur': 'అనంతపురం',
  'machilipatnam': 'మచిలీపట్నం',
};

function normalize(raw?: string): string {
  return String(raw || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function getTeluguPlaceName(raw?: string): string | null {
  if (!raw) return null;
  // try full match
  const key = normalize(raw);
  if (TELUGU_PLACES[key]) return TELUGU_PLACES[key];
  // try removing suffixes like 'district', 'mandal', etc.
  const cleaned = key.replace(/\s+(district|mandal|city|state)$/i, '').trim();
  if (TELUGU_PLACES[cleaned]) return TELUGU_PLACES[cleaned];
  // try first token before comma
  const firstToken = key.split(',')[0]?.trim();
  if (TELUGU_PLACES[firstToken]) return TELUGU_PLACES[firstToken];
  return null;
}
