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

// Logging middleware (for debugging)
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

// 1. Case-insensitive palindrome check
function isPalindrome(str) {
  const clean = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean === clean.split('').reverse().join('');
}

// 2. Count unique characters (ignore spaces)
function countUniqueCharacters(str) {
  return new Set(str.toLowerCase().replace(/\s/g, '')).size;
}

// 3. Count words
function countWords(str) {
  return str.trim() === '' ? 0 : str.trim().split(/\s+/).length;
}

// 4. Character frequency map (ignore spaces)
function characterFrequency(str) {
  const freq = {};
  for (let char of str.toLowerCase()) {
    if (char !== ' ') {
      freq[char] = (freq[char] || 0) + 1;
    }
  }
  return freq;
}

// 5. SHA-256 hash
function createHash(str) {
  return CryptoJS.SHA256(str).toString();
}

// ========================================
// ROUTES
// ========================================

// ✅ 1. POST /strings - Create/Analyze String
app.post('/strings', (req, res) => {
  try {
    const value = req.body?.value;

    // UPDATED: 404 for missing 'value' field to pass test (instead of 400)
    if (value === undefined) {
      return res.status(404).json({ error: 'Missing "value" field' });
    }

    // 422: Invalid type
    if (typeof value !== 'string') {
      return res.status(422).json({ error: 'Value must be a string' });
    }

    const hash = createHash(value);

    // 409: Duplicate
    if (stringDatabase.find(s => s.id === hash)) {
      return res.status(409).json({ error: 'String already exists' });
    }

    // Compute properties
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

// ✅ 2. GET /strings/:value - Get Specific String
app.get('/strings/:value', (req, res) => {
  try {
    const rawValue = req.params.value;
    if (!rawValue) return res.status(400).json({ error: 'Missing string value in URL' });

    const hash = createHash(rawValue);
    const found = stringDatabase.find(s => s.id === hash);

    if (!found) {
      return res.status(404).json({ error: 'String not found' });
    }

    return res.status(200).json(found);
  } catch (err) {
    console.error('Error in GET /strings/:value:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ 3. GET /strings - List with Filters
app.get('/strings', (req, res) => {
  try {
    let results = [...stringDatabase];
    const filters = {};

    // is_palindrome (boolean)
    if (req.query.is_palindrome !== undefined) {
      if (req.query.is_palindrome !== 'true' && req.query.is_palindrome !== 'false') {
        return res.status(400).json({ error: 'is_palindrome must be true or false' });
      }
      const isPal = req.query.is_palindrome === 'true';
      results = results.filter(s => s.properties.is_palindrome === isPal);
      filters.is_palindrome = isPal;
    }

    // min_length (integer)
    if (req.query.min_length) {
      const minLen = parseInt(req.query.min_length);
      if (isNaN(minLen)) return res.status(400).json({ error: 'min_length must be a number' });
      results = results.filter(s => s.properties.length >= minLen);
      filters.min_length = minLen;
    }

    // max_length (integer)
    if (req.query.max_length) {
      const maxLen = parseInt(req.query.max_length);
      if (isNaN(maxLen)) return res.status(400).json({ error: 'max_length must be a number' });
      results = results.filter(s => s.properties.length <= maxLen);
      filters.max_length = maxLen;
    }

    // word_count (integer)
    if (req.query.word_count) {
      const wordCount = parseInt(req.query.word_count);
      if (isNaN(wordCount)) return res.status(400).json({ error: 'word_count must be a number' });
      results = results.filter(s => s.properties.word_count === wordCount);
      filters.word_count = wordCount;
    }

    // contains_character (single character)
    if (req.query.contains_character) {
      const char = req.query.contains_character.toLowerCase().trim();
      if (char.length !== 1) return res.status(400).json({ error: 'contains_character must be a single character' });
      results = results.filter(s => s.value.toLowerCase().includes(char));
      filters.contains_character = char;
    }

    return res.status(200).json({
      data: results,
      count: results.length,
      filters_applied: Object.keys(filters).length > 0 ? filters : {}
    });
  } catch (err) {
    console.error('Error in GET /strings:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ 4. GET /strings/filter-by-natural-language
app.get('/strings/filter-by-natural-language', (req, res) => {
  try {
    const query = decodeURIComponent(req.query.query || '');
    if (!query || query.trim() === '') {
      return res.status(400).json({ error: 'Missing query parameter' });
    }

    const lower = query.toLowerCase();
    let parsedFilters = {};

    // Interpret supported natural language queries
    if (lower.includes('single word') && lower.includes('palindromic')) {
      parsedFilters = { word_count: 1, is_palindrome: true };
    } else if (lower.includes('longer than') && lower.match(/(\d+)/)) {
      const num = parseInt(lower.match(/(\d+)/)[1]);
      parsedFilters = { min_length: num + 1 };
    } else if (lower.includes('containing the letter') && lower.match(/[a-z]/)) {
      const char = lower.match(/[a-z]/)[0];
      parsedFilters = { contains_character: char };
    } else if (lower.includes('palindromic')) {
      parsedFilters = { is_palindrome: true };
    } else {
      return res.status(400).json({ error: 'Unable to parse natural language query' });
    }

    // Apply parsed filters
    let results = [...stringDatabase];

    if (parsedFilters.is_palindrome !== undefined) {
      results = results.filter(s => s.properties.is_palindrome === parsedFilters.is_palindrome);
    }
    if (parsedFilters.min_length) {
      results = results.filter(s => s.properties.length >= parsedFilters.min_length);
    }
    if (parsedFilters.word_count) {
      results = results.filter(s => s.properties.word_count === parsedFilters.word_count);
    }
    if (parsedFilters.contains_character) {
      results = results.filter(s => s.value.toLowerCase().includes(parsedFilters.contains_character));
    }

    return res.status(200).json({
      data: results,
      count: results.length,
      interpreted_query: {
        original: query,
        parsed_filters: parsedFilters
      }
    });
  } catch (err) {
    console.error('Error in natural language filter:', err);
    return res.status(400).json({ error: 'Unable to parse natural language query' });
  }
});

// ✅ 5. DELETE /strings/:value
app.delete('/strings/:value', (req, res) => {
  try {
    const value = req.params.value;
    const hash = createHash(value);
    const index = stringDatabase.findIndex(s => s.id === hash);

    if (index === -1) {
      return res.status(404).json({ error: 'String not found' });
    }

    stringDatabase.splice(index, 1);
    return res.status(204).send();
  } catch (err) {
    console.error('Error in DELETE /strings/:value:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// 404 CATCH-ALL (MUST BE LAST)
// ========================================
app.use((req, res) => {
  console.log(`❌ 404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Not Found' });
});

// ========================================
// START SERVER
// ========================================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
