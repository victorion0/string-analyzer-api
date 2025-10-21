// STEP 1: Import your tools (like including libraries in school)
const express = require('express');
const CryptoJS = require('crypto-js');
const cors = require('cors');
require('dotenv').config();

// STEP 2: Create your server (like opening a restaurant)
const app = express();
const PORT = process.env.PORT || 3000;

// STEP 3: Let server understand JSON (like learning a language)
app.use(express.json());
app.use(cors());

// STEP 4: Create storage (like a notebook for strings)
let stringDatabase = [];

// ========================================
// HELPER FUNCTIONS (Your Math Calculator)
// ========================================

// Function 1: Check if palindrome (reads same forwards/backwards)
function isPalindrome(str) {
    const clean = str.toLowerCase().replace(/[^a-z0-9]/g, '');
    return clean === clean.split('').reverse().join('');
}

// Function 2: Count unique characters
function countUniqueCharacters(str) {
    return new Set(str.toLowerCase().replace(/\s/g, '')).size;
}

// Function 3: Count words
function countWords(str) {
    return str.trim() === '' ? 0 : str.trim().split(/\s+/).length;
}

// Function 4: Count character frequency
function characterFrequency(str) {
    const freq = {};
    for (let char of str.toLowerCase()) {
        if (char !== ' ') {
            freq[char] = (freq[char] || 0) + 1;
        }
    }
    return freq;
}

// Function 5: Create unique ID (like a fingerprint)
function createHash(str) {
    return CryptoJS.SHA256(str).toString();
}

// ========================================
// ENDPOINTS (Your Restaurant Menu)
// ========================================

// ENDPOINT 1: CREATE/ANALYZE STRING (POST /strings)
app.post('/strings', (req, res) => {
    console.log('🆕 Someone wants to analyze:', req.body.value);
    
    // Check if value exists
    if (!req.body.value) {
        return res.status(400).json({ error: 'Missing "value" field' });
    }
    
    if (typeof req.body.value !== 'string') {
        return res.status(422).json({ error: 'Value must be a string' });
    }
    
    const value = req.body.value;
    const hash = createHash(value);
    
    // Check if already exists
    if (stringDatabase.find(s => s.id === hash)) {
        return res.status(409).json({ error: 'String already exists' });
    }
    
    // Calculate properties
    const properties = {
        length: value.length,
        is_palindrome: isPalindrome(value),
        unique_characters: countUniqueCharacters(value),
        word_count: countWords(value),
        sha256_hash: hash,
        character_frequency_map: characterFrequency(value)
    };
    
    // Save to database
    const newString = {
        id: hash,
        value: value,
        properties: properties,
        created_at: new Date().toISOString()
    };
    
    stringDatabase.push(newString);
    
    // Send success response
    res.status(201).json(newString);
});

// ENDPOINT 2: GET SPECIFIC STRING (GET /strings/{value})
app.get('/strings/:value', (req, res) => {
    const value = req.params.value;
    const hash = createHash(value);
    const found = stringDatabase.find(s => s.id === hash);
    
    if (!found) {
        return res.status(404).json({ error: 'String not found' });
    }
    
    res.json(found);
});

// ENDPOINT 3: GET ALL STRINGS WITH FILTERS (GET /strings)
app.get('/strings', (req, res) => {
    let results = [...stringDatabase];
    const filters = {};
    
    // Apply filters
    if (req.query.is_palindrome !== undefined) {
        const isPal = req.query.is_palindrome === 'true';
        results = results.filter(s => s.properties.is_palindrome === isPal);
        filters.is_palindrome = isPal;
    }
    
    if (req.query.min_length) {
        const minLen = parseInt(req.query.min_length);
        results = results.filter(s => s.properties.length >= minLen);
        filters.min_length = minLen;
    }
    
    if (req.query.max_length) {
        const maxLen = parseInt(req.query.max_length);
        results = results.filter(s => s.properties.length <= maxLen);
        filters.max_length = maxLen;
    }
    
    if (req.query.word_count) {
        const wordCount = parseInt(req.query.word_count);
        results = results.filter(s => s.properties.word_count === wordCount);
        filters.word_count = wordCount;
    }
    
    if (req.query.contains_character) {
        const char = req.query.contains_character.toLowerCase();
        results = results.filter(s => s.value.toLowerCase().includes(char));
        filters.contains_character = char;
    }
    
    // Send response
    res.json({
        data: results,
        count: results.length,
        filters_applied: filters
    });
});

// ENDPOINT 4: NATURAL LANGUAGE FILTERING
app.get('/strings/filter-by-natural-language', (req, res) => {
    const query = decodeURIComponent(req.query.query || '');
    
    if (!query) {
        return res.status(400).json({ error: 'Missing query parameter' });
    }
    
    // Simple natural language parser
    const lowerQuery = query.toLowerCase();
    let parsedFilters = {};
    
    // Parse different query types
    if (lowerQuery.includes('single word') && lowerQuery.includes('palindromic')) {
        parsedFilters = { word_count: 1, is_palindrome: true };
    } 
    else if (lowerQuery.includes('palindromic') && lowerQuery.includes('vowel')) {
        parsedFilters = { is_palindrome: true, contains_character: 'a' };
    }
    else if (lowerQuery.includes('longer than') && lowerQuery.match(/(\d+)/)) {
        const length = parseInt(lowerQuery.match(/(\d+)/)[1]) + 1;
        parsedFilters = { min_length: length };
    }
    else if (lowerQuery.includes('contain') && lowerQuery.includes('letter')) {
        const charMatch = lowerQuery.match(/[a-z]/);
        parsedFilters = { contains_character: charMatch ? charMatch[0] : 'a' };
    }
    else {
        return res.status(400).json({ error: 'Unable to parse query' });
    }
    
    // Apply filters (reuse our filter logic)
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
    
    res.json({
        data: results,
        count: results.length,
        interpreted_query: {
            original: query,
            parsed_filters: parsedFilters
        }
    });
});

// ENDPOINT 5: DELETE STRING
app.delete('/strings/:value', (req, res) => {
    const value = req.params.value;
    const hash = createHash(value);
    
    const index = stringDatabase.findIndex(s => s.id === hash);
    
    if (index === -1) {
        return res.status(404).json({ error: 'String not found' });
    }
    
    stringDatabase.splice(index, 1);
    res.status(204).send();
});

// ========================================
// START SERVER
// ========================================
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});