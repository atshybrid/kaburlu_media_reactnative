export const DATE_LINE_LEXICON = {
  hierarchy_keys: ['state', 'district', 'mandal', 'village'] as const,

  languages: {
    en: {
      name: 'English',
      labels: { state: 'State', district: 'District', mandal: 'Mandal', village: 'Village' },
      months: [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ],
    },

    hi: {
      name: 'Hindi',
      labels: { state: 'राज्य', district: 'ज़िला', mandal: 'तहसील', village: 'गाँव' },
      months: [
        'जनवरी',
        'फ़रवरी',
        'मार्च',
        'अप्रैल',
        'मई',
        'जून',
        'जुलाई',
        'अगस्त',
        'सितंबर',
        'अक्टूबर',
        'नवंबर',
        'दिसंबर',
      ],
    },

    te: {
      name: 'Telugu',
      labels: { state: 'రాష్ట్రం', district: 'జిల్లా', mandal: 'మండలం', village: 'గ్రామం' },
      months: [
        'జనవరి',
        'ఫిబ్రవరి',
        'మార్చి',
        'ఏప్రిల్',
        'మే',
        'జూన్',
        'జూలై',
        'ఆగస్టు',
        'సెప్టెంబర్',
        'అక్టోబర్',
        'నవంబర్',
        'డిసెంబర్',
      ],
    },

    ta: {
      name: 'Tamil',
      labels: { state: 'மாநிலம்', district: 'மாவட்டம்', mandal: 'வட்டம்', village: 'கிராமம்' },
      months: [
        'ஜனவரி',
        'பிப்ரவரி',
        'மார்ச்',
        'ஏப்ரல்',
        'மே',
        'ஜூன்',
        'ஜூலை',
        'ஆகஸ்ட்',
        'செப்டம்பர்',
        'அக்டோபர்',
        'நவம்பர்',
        'டிசம்பர்',
      ],
    },

    bn: {
      name: 'Bengali',
      labels: { state: 'রাজ্য', district: 'জেলা', mandal: 'ব্লক', village: 'গ্রাম' },
      months: [
        'জানুয়ারি',
        'ফেব্রুয়ারি',
        'মার্চ',
        'এপ্রিল',
        'মে',
        'জুন',
        'জুলাই',
        'আগস্ট',
        'সেপ্টেম্বর',
        'অক্টোবর',
        'নভেম্বর',
        'ডিসেম্বর',
      ],
    },

    mr: {
      name: 'Marathi',
      labels: { state: 'राज्य', district: 'जिल्हा', mandal: 'तालुका', village: 'गाव' },
      months: [
        'जानेवारी',
        'फेब्रुवारी',
        'मार्च',
        'एप्रिल',
        'मे',
        'जून',
        'जुलै',
        'ऑगस्ट',
        'सप्टेंबर',
        'ऑक्टोबर',
        'नोव्हेंबर',
        'डिसेंबर',
      ],
    },

    ur: {
      name: 'Urdu',
      labels: { state: 'ریاست', district: 'ضلع', mandal: 'تحصیل', village: 'گاؤں' },
      months: [
        'جنوری',
        'فروری',
        'مارچ',
        'اپریل',
        'مئی',
        'جون',
        'جولائی',
        'اگست',
        'ستمبر',
        'اکتوبر',
        'نومبر',
        'دسمبر',
      ],
    },

    gu: {
      name: 'Gujarati',
      labels: { state: 'રાજ્ય', district: 'જિલ્લો', mandal: 'તાલુકો', village: 'ગામ' },
      months: [
        'જાન્યુઆરી',
        'ફેબ્રુઆરી',
        'માર્ચ',
        'એપ્રિલ',
        'મે',
        'જૂન',
        'જુલાઈ',
        'ઓગસ્ટ',
        'સપ્ટેમ્બર',
        'ઓક્ટોબર',
        'નવેમ્બર',
        'ડિસેમ્બર',
      ],
    },

    kn: {
      name: 'Kannada',
      labels: { state: 'ರಾಜ್ಯ', district: 'ಜಿಲ್ಲೆ', mandal: 'ತಾಲೂಕು', village: 'ಗ್ರಾಮ' },
      months: [
        'ಜನವರಿ',
        'ಫೆಬ್ರವರಿ',
        'ಮಾರ್ಚ್',
        'ಏಪ್ರಿಲ್',
        'ಮೇ',
        'ಜೂನ್',
        'ಜುಲೈ',
        'ಆಗಸ್ಟ್',
        'ಸೆಪ್ಟೆಂಬರ್',
        'ಅಕ್ಟೋಬರ್',
        'ನವೆಂಬರ್',
        'ಡಿಸೆಂಬರ್',
      ],
    },

    ml: {
      name: 'Malayalam',
      labels: { state: 'സംസ്ഥാനം', district: 'ജില്ല', mandal: 'താലൂക്ക്', village: 'ഗ്രാമം' },
      months: [
        'ജനുവരി',
        'ഫെബ്രുവരി',
        'മാർച്ച്',
        'ഏപ്രിൽ',
        'മേയ്',
        'ജൂൺ',
        'ജൂലൈ',
        'ഓഗസ്റ്റ്',
        'സെപ്റ്റംബർ',
        'ഒക്ടോബർ',
        'നവംബർ',
        'ഡിസംബർ',
      ],
    },

    pa: {
      name: 'Punjabi',
      labels: { state: 'ਰਾਜ', district: 'ਜ਼ਿਲ੍ਹਾ', mandal: 'ਤਹਿਸੀਲ', village: 'ਪਿੰਡ' },
      months: [
        'ਜਨਵਰੀ',
        'ਫਰਵਰੀ',
        'ਮਾਰਚ',
        'ਅਪ੍ਰੈਲ',
        'ਮਈ',
        'ਜੂਨ',
        'ਜੁਲਾਈ',
        'ਅਗਸਤ',
        'ਸਤੰਬਰ',
        'ਅਕਤੂਬਰ',
        'ਨਵੰਬਰ',
        'ਦਸੰਬਰ',
      ],
    },

    or: {
      name: 'Odia',
      labels: { state: 'ରାଜ୍ୟ', district: 'ଜିଲ୍ଲା', mandal: 'ବ୍ଲକ', village: 'ଗାଁ' },
      months: [
        'ଜାନୁଆରୀ',
        'ଫେବୃଆରୀ',
        'ମାର୍ଚ୍ଚ',
        'ଏପ୍ରିଲ',
        'ମେ',
        'ଜୁନ',
        'ଜୁଲାଇ',
        'ଅଗଷ୍ଟ',
        'ସେପ୍ଟେମ୍ବର',
        'ଅକ୍ଟୋବର',
        'ନଭେମ୍ବର',
        'ଡିସେମ୍ବର',
      ],
    },

    as: {
      name: 'Assamese',
      labels: { state: 'ৰাজ্য', district: 'জিলা', mandal: 'উন্নয়ন খণ্ড', village: 'গাঁও' },
      months: [
        'জানুৱাৰী',
        'ফেব্ৰুৱাৰী',
        'মাৰ্চ',
        'এপ্ৰিল',
        'মে',
        'জুন',
        'জুলাই',
        'আগষ্ট',
        'ছেপ্টেম্বৰ',
        'অক্টোবৰ',
        'নৱেম্বৰ',
        'ডিচেম্বৰ',
      ],
    },
  },
} as const;

export type DateLineLangCode = keyof typeof DATE_LINE_LEXICON.languages;
export type DateLineHierarchyKey = (typeof DATE_LINE_LEXICON.hierarchy_keys)[number];

export function normalizeLangBaseCode(langCode?: string): string {
  return String(langCode || 'en').toLowerCase().split('-')[0] || 'en';
}

export function getDateLineLanguage(langCode?: string): DateLineLangCode {
  const base = normalizeLangBaseCode(langCode);
  return (Object.prototype.hasOwnProperty.call(DATE_LINE_LEXICON.languages, base) ? (base as DateLineLangCode) : 'en');
}

export function locationTypeToHierarchyKey(type?: string): DateLineHierarchyKey | null {
  const t = String(type || '').toLowerCase();
  if (t === 'state') return 'state';
  if (t === 'district') return 'district';
  if (t === 'mandal') return 'mandal';
  if (t === 'village') return 'village';
  return null;
}

export function getHierarchyLabel(langCode?: string, typeOrKey?: string): string {
  const lang = getDateLineLanguage(langCode);
  const key = (typeOrKey && (DATE_LINE_LEXICON.hierarchy_keys as readonly string[]).includes(String(typeOrKey).toLowerCase()))
    ? (String(typeOrKey).toLowerCase() as DateLineHierarchyKey)
    : locationTypeToHierarchyKey(typeOrKey);
  if (!key) return '';
  return DATE_LINE_LEXICON.languages[lang].labels[key] || '';
}

export function formatMonthDayFromLexicon(langCode?: string, d = new Date()): string {
  const lang = getDateLineLanguage(langCode);
  const months = DATE_LINE_LEXICON.languages[lang]?.months;
  const month = months?.[d.getMonth()];
  const day = String(d.getDate()).padStart(2, '0');
  if (month) return `${month} ${day}`;
  return day;
}
