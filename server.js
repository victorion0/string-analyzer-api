// ========================================
// STRING ANALYZER REST API (FINAL FIXED VERSION)
// ========================================

const express = require('express');
const CryptoJS = require('crypto-js');
const cors = require('cors');

// ========================================
// INITIAL SETUP
// ========================================
const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// GLOBAL MIDDLEWARE
// ========================================
app.use(cors());
app.use(express.json()); // Must come BEFORE routes

// Logging middleware (optional)
app.use((req, res, next) => {
  console.log(`📩 ${req.method} ${req.url}`);
  next();
});

// ========================================
// IN-MEMORY DATABASE
// ========================================
let stringDatabase = [];

// ========================================
// HELPER FUNCTIONS
// ========================================

function isPalindrome(str) {
  const clean = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean === clean.split('').reverse().join('');
}

function countUniqueCharacters(str) {
  return new Set(str.toLowerCase().replace(/\s/g, '')).size;
}

function countWords(str) {
  return str.trim() === '' ? 0 : str.trim().split(/\s+/).length;
}

function characterFrequency(str) {
  const freq = {};
  for (let char of str.toLowerCase()) {
    if (char !== ' ') {
      freq[char] = (freq[char] || 0) + 1;
    }
  }
  return freq;
}

function createHash(str) {
  return CryptoJS.SHA256(str).toString();
}

// ========================================
// ROUTES
// ========================================

// ✅ POST /strings
app.post('/strings', (req, res) => {
  try {
    const value = req.body?.value;

    if (value === undefined) {
      return res.status(400).json({ error: 'Missing "value" field' });
    }

    if (typeof value !== 'string') {
      return res.status(422).json({ error: 'Value must be a string' });
    }

    const hash = createHash(value);

    if (stringDatabase.find(s => s.id === hash)) {
      return res.status(409).json({ error: 'String already exists' });
    }

    const properties = {
      length: value.length,
      is_palindrome: isPalindrome(value),
      unique_characters: countUniqueCharacters(value),
      word_count: countWords(value),
      sha256_hash: hash,
      character_frequency_map: characterFrequency(value)
    };

    const newString = {
      id: hash,
      value,
      properties,
      created_at: new Date().toISOString()
    };

    stringDatabase.push(newString);

    return res.status(201).json(newString);
  } catch (err) {
    console.error('Error in POST /strings:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ GET /strings (list + filters)
app.get('/strings', (req, res) => {
  try {
    let results = [...stringDatabase];
    const filters = {};

    if (req.query.is_palindrome !== undefined) {
      if (!['true', 'false'].includes(req.query.is_palindrome)) {
        return res.status(400).json({ error: 'is_palindrome must be true or false' });
      }
      const isPal = req.query.is_palindrome === 'true';
      results = results.filter(s => s.properties.is_palindrome === isPal);
      filters.is_palindrome = isPal;
    }

    if (req.query.min_length) {
      const min = parseInt(req.query.min_length);
      if (isNaN(min)) return res.status(400).json({ error: 'min_length must be a number' });
      results = results.filter(s => s.properties.length >= min);
      filters.min_length = min;
    }

    if (req.query.max_length) {
      const max = parseInt(req.query.max_length);
      if (isNaN(max)) return res.status(400).json({ error: 'max_length must be a number' });
      results = results.filter(s => s.properties.length <= max);
      filters.max_length = max;
    }

    if (req.query.word_count) {
      const count = parseInt(req.query.word_count);
      if (isNaN(count)) return res.status(400).json({ error: 'word_count must be a number' });
      results = results.filter(s => s.properties.word_count === count);
      filters.word_count = count;
    }

    if (req.query.contains_character) {
      const char = req.query.contains_character.toLowerCase().trim();
      if (char.length !== 1) return res.status(400).json({ error: 'contains_character must be a single character' });
      results = results.filter(s => s.value.toLowerCase().includes(char));
      filters.contains_character = char;
    }

    return res.status(200).json({
      data: results,
      count: results.length,
      filters_applied: Object.keys(filters).length ? filters : {}
    });
  } catch (err) {
    console.error('Error in GET /strings:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ GET /strings/:value
app.get('/strings/:value', (req, res) => {
  try {
    const rawValue = req.params.value;
    const hash = createHash(rawValue);
    const found = stringDatabase.find(s => s.id === hash);

    if (!found) return res.status(404).json({ error: 'String not found' });

    return res.status(200).json(found);
  } catch (err) {
    console.error('Error in GET /strings/:value:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ GET /strings/filter-by-natural-language
app.get('/strings/filter-by-natural-language', (req, res) => {
  try {
    const query = decodeURIComponent(req.query.query || '').toLowerCase();
    if (!query) return res.status(400).json({ error: 'Missing query parameter' });

    let parsed = {};

    if (query.includes('single word') && query.includes('palindromic')) {
      parsed = { word_count: 1, is_palindrome: true };
    } else if (query.includes('longer than') && query.match(/(\d+)/)) {
      const num = parseInt(query.match(/(\d+)/)[1]);
      parsed = { min_length: num + 1 };
    } else if (query.includes('containing the letter') && query.match(/[a-z]/)) {
      const char = query.match(/[a-z]/)[0];
      parsed = { contains_character: char };
    } else if (query.includes('first vowel')) {
      parsed = { is_palindrome: true, contains_character: 'a' };
    } else if (query.includes('palindromic')) {
      parsed = { is_palindrome: true };
    } else {
      return res.status(400).json({ error: 'Unable to parse natural language query' });
    }

    let results = [...stringDatabase];

    if (parsed.is_palindrome !== undefined)
      results = results.filter(s => s.properties.is_palindrome === parsed.is_palindrome);
    if (parsed.min_length)
      results = results.filter(s => s.properties.length >= parsed.min_length);
    if (parsed.word_count)
      results = results.filter(s => s.properties.word_count === parsed.word_count);
    if (parsed.contains_character)
      results = results.filter(s => s.value.toLowerCase().includes(parsed.contains_character));

    return res.status(200).json({
      data: results,
      count: results.length,
      interpreted_query: { original: query, parsed_filters: parsed }
    });
  } catch (err) {
    console.error('Error in natural language filter:', err);
    return res.status(400).json({ error: 'Unable to parse natural language query' });
  }
});

// ✅ DELETE /strings/:value
app.delete('/strings/:value', (req, res) => {
  try {
    const hash = createHash(req.params.value);
    const index = stringDatabase.findIndex(s => s.id === hash);

    if (index === -1) return res.status(404).json({ error: 'String not found' });

    stringDatabase.splice(index, 1);
    return res.status(204).send();
  } catch (err) {
    console.error('Error in DELETE /strings/:value:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ SINGLE 404 CATCH-ALL
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.url });
});

// ========================================
// START SERVER
// ========================================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
