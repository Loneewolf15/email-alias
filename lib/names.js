import fs from 'fs';
import path from 'path';

const SCRIPT_DIR = process.cwd();

// Built-in seed banks if files ever missing
const SEED_FIRST_NAMES = [
  'Adewale', 'Adeola', 'Adebayo', 'Ayodele', 'Bolanle', 'Chidi', 'Chioma',
  'Emeka', 'Kelechi', 'Nnamdi', 'Obinna', 'Abdullahi', 'Aisha', 'Fatima',
  'Ibrahim', 'Maryam', 'Mohammed', 'Usman', 'Zainab', 'Osas', 'Efe', 'Itohan'
];

const SEED_LAST_NAMES = [
  'Adebayo', 'Adeyemi', 'Afolabi', 'Akinwale', 'Balogun', 'Achebe', 'Chukwu',
  'Eze', 'Igwe', 'Okafor', 'Okonkwo', 'Okoro', 'Aliyu', 'Aminu', 'Bello',
  'Dantata', 'Haruna', 'Musa', 'Sani', 'Yusuf', 'Osagie', 'Idehen'
];

export function sanitizeSlug(text) {
  return (text || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

export function loadLinesFromFile(filename) {
  const possiblePaths = [
    path.join(SCRIPT_DIR, filename),
    path.join(SCRIPT_DIR, `${filename}.txt`),
    path.join('/tmp', filename),
    path.join('/tmp', `${filename}.txt`),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        const lines = raw.split('\n')
          .map(l => l.trim())
          .filter(l => l && !l.startsWith('#'))
          .map(l => l.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '));
        return Array.from(new Set(lines));
      } catch (err) {
        console.error(`Error reading ${p}:`, err);
      }
    }
  }
  return [];
}

import { NAME_BANKS } from './nameData';

export function getPoolsByCategory(category = 'all') {
  let firstNames = [];
  let lastNames = [];

  const commonFirst = NAME_BANKS.commonFirst || [];
  const commonLast = NAME_BANKS.commonLast || [];
  const yorubaFirst = NAME_BANKS.yorubaFirst || [];
  const igboFirst = NAME_BANKS.igboFirst || [];
  const igboLast = NAME_BANKS.igboLast || [];
  const edoNames = NAME_BANKS.edoNames || [];

  if (category === 'yoruba') {
    firstNames = yorubaFirst.length ? yorubaFirst : commonFirst;
    lastNames = commonLast.length ? commonLast : ['Adebayo', 'Adeyemi', 'Balogun'];
  } else if (category === 'igbo') {
    firstNames = igboFirst.length ? igboFirst : commonFirst;
    lastNames = igboLast.length ? igboLast : commonLast;
  } else if (category === 'edo') {
    firstNames = edoNames.length ? edoNames : commonFirst;
    lastNames = commonLast.length ? commonLast : ['Osagie', 'Idehen', 'Igbinedion'];
  } else {
    // Merged all
    firstNames = Array.from(new Set([
      ...commonFirst,
      ...yorubaFirst,
      ...igboFirst,
      ...edoNames
    ]));
    lastNames = Array.from(new Set([
      ...commonLast,
      ...igboLast
    ]));
  }

  return {
    firstNames: firstNames.filter(Boolean),
    lastNames: lastNames.filter(Boolean),
    counts: {
      commonFirst: commonFirst.length,
      commonLast: commonLast.length,
      yorubaFirst: yorubaFirst.length,
      igboFirst: igboFirst.length,
      igboLast: igboLast.length,
      edoNames: edoNames.length,
      totalFirst: firstNames.length,
      totalLast: lastNames.length,
    }
  };
}

function getFilePath(filename) {
  const tmpPath = path.join('/tmp', filename);
  const cwdPath = path.join(SCRIPT_DIR, filename);

  // If in read-only environment (e.g. Vercel), /tmp is the writable storage
  if (process.env.VERCEL) {
    if (fs.existsSync(tmpPath)) return tmpPath;
    if (fs.existsSync(cwdPath)) {
      try {
        fs.copyFileSync(cwdPath, tmpPath);
        return tmpPath;
      } catch (e) {
        return cwdPath;
      }
    }
    return tmpPath;
  }
  return cwdPath;
}

function writeSafe(filename, data) {
  const targetPath = getFilePath(filename);
  try {
    fs.writeFileSync(targetPath, data, 'utf-8');
  } catch (err) {
    try {
      const fallback = path.join('/tmp', filename);
      fs.writeFileSync(fallback, data, 'utf-8');
    } catch (e) {
      console.error(`Failed writing ${filename}:`, e.message);
    }
  }
}

export function loadHistory() {
  const filePath = getFilePath('history.json');
  if (!fs.existsSync(filePath)) {
    // Check cwd as fallback
    const cwdPath = path.join(SCRIPT_DIR, 'history.json');
    if (fs.existsSync(cwdPath)) {
      try { return JSON.parse(fs.readFileSync(cwdPath, 'utf-8')); } catch(e) {}
    }
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

export function appendHistory(newEntries) {
  if (!newEntries || newEntries.length === 0) return;
  const history = loadHistory();
  const updated = [...history, ...newEntries];
  writeSafe('history.json', JSON.stringify(updated, null, 2));
}

export function loadRegistry() {
  const filePath = getFilePath('aliases.json');
  if (!fs.existsSync(filePath)) {
    const cwdPath = path.join(SCRIPT_DIR, 'aliases.json');
    if (fs.existsSync(cwdPath)) {
      try { return JSON.parse(fs.readFileSync(cwdPath, 'utf-8')); } catch(e) {}
    }
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

export function saveRegistry(entries) {
  writeSafe('aliases.json', JSON.stringify(entries || [], null, 2));
}

export function getUsedNamesSet() {
  const history = loadHistory();
  const registry = loadRegistry();
  const used = new Set();

  for (const item of [...history, ...registry]) {
    if (item.full_name) {
      used.add(item.full_name.trim().toLowerCase());
    }
    if (item.alias) {
      used.add(item.alias.trim().toLowerCase());
    }
  }
  return used;
}

export function generateNamePairs(count = 10, category = 'all') {
  const { firstNames, lastNames } = getPoolsByCategory(category);
  const usedHistory = getUsedNamesSet();
  const generatedPairs = [];
  const currentBatchUsed = new Set();

  for (let i = 0; i < count; i++) {
    let chosenPair = null;

    // Try up to 400 random attempts to find an historically unique pair
    for (let attempt = 0; attempt < 400; attempt++) {
      const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
      const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
      const fullName = `${fn} ${ln}`;
      const lower = fullName.toLowerCase();

      if (!usedHistory.has(lower) && !currentBatchUsed.has(lower)) {
        chosenPair = { firstName: fn, lastName: ln, fullName };
        currentBatchUsed.add(lower);
        break;
      }
    }

    // Fallback disambiguator if pool depleted
    if (!chosenPair) {
      const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
      const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
      const num = Math.floor(Math.random() * 90) + 10;
      const fullName = `${fn} ${ln}${num}`;
      chosenPair = { firstName: fn, lastName: `${ln}${num}`, fullName };
    }

    const prefix = `${sanitizeSlug(chosenPair.firstName)}.${sanitizeSlug(chosenPair.lastName)}`;
    generatedPairs.push({
      ...chosenPair,
      suggestedPrefix: prefix,
      category
    });
  }

  return generatedPairs;
}
