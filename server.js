const express = require('express');
const CryptoJS = require('crypto-js');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// In-memory database
let stringDatabase = [];

// HELPER FUNCTIONS
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
        if (char !== ' ') freq[char] = (freq[char] || 0) + 1;
    }
    return freq;
}

function createHash(str) {
    return CryptoJS.SHA256(str).toString();
}

// ========================================
// ROUTES (FIXED!)
// ========================================

// 1. POST /strings - CREATE
app.post('/strings', (req, res) => {
    // VALIDATION
    if (!req.body.value) return res.status(400).json({ error: 'Missing "value" field' });
    if (typeof req.body.value !== 'string') return res.status(422).json({ error: 'Value must be a string' });
    
    const value = req.body.value;
    const hash = createHash(value);
    
    // CHECK DUPLICATE
    if (stringDatabase.find(s => s.id === hash)) {
        return res.status(409).json({ error: 'String already exists' });
    }
    
    // COMPUTE PROPERTIES
    const properties = {
        length: value.length,
        is_palindrome: isPalindrome(value),
        unique_characters: countUniqueCharacters(value),
        word_count: countWords(value),
        sha256_hash: hash,
        character_frequency_map: characterFrequency(value)
    };
    
    // SAVE
    const newString = {
        id: hash,
        value: value,
        properties: properties,
        created_at: new Date().toISOString()
    };
    
    stringDatabase.push(newString);
    res.status(201).json(newString); // FIXED: 201 CREATED
});

// 2. GET /strings/:value - SPECIFIC STRING
app.get('/strings/:value', (req, res) => {
    const hash = createHash(req.params.value);
    const found = stringDatabase.find(s => s.id === hash);
    
    if (!found) return res.status(404).json({ error: 'String not found' });
    res.json(found);
});

// 3. GET /strings - LIST WITH FILTERS
app.get('/strings', (req, res) => {
    let results = [...stringDatabase];
    const filters = {};
    
    // FILTER: is_palindrome
    if (req.query.is_palindrome) {
        const isPal = req.query.is_palindrome === 'true';
        results = results.filter(s => s.properties.is_palindrome === isPal);
        filters.is_palindrome = isPal;
    }
    
    // FILTER: min_length
    if (req.query.min_length) {
        const minLen = parseInt(req.query.min_length);
        if (!isNaN(minLen)) {
            results = results.filter(s => s.properties.length >= minLen);
            filters.min_length = minLen;
        }
    }
    
    // FILTER: max_length
    if (req.query.max_length) {
        const maxLen = parseInt(req.query.max_length);
        if (!isNaN(maxLen)) {
            results = results.filter(s => s.properties.length <= maxLen);
            filters.max_length = maxLen;
        }
    }
    
    // FILTER: word_count
    if (req.query.word_count) {
        const wordCount = parseInt(req.query.word_count);
        if (!isNaN(wordCount)) {
            results = results.filter(s => s.properties.word_count === wordCount);
            filters.word_count = wordCount;
        }
    }
    
    // FILTER: contains_character
    if (req.query.contains_character) {
        const char = req.query.contains_character.toLowerCase();
        results = results.filter(s => s.value.toLowerCase().includes(char));
        filters.contains_character = char;
    }
    
    res.json({
        data: results,
        count: results.length,
        filters_applied: Object.keys(filters).length ? filters : {}
    });
});

// 4. GET /strings/filter-by-natural-language
app.get('/strings/filter-by-natural-language', (req, res) => {
    const query = decodeURIComponent(req.query.query || '');
    
    if (!query) return res.status(400).json({ error: 'Missing query parameter' });
    
    const lowerQuery = query.toLowerCase();
    let parsedFilters = {};
    
    // PARSE NATURAL LANGUAGE
    if (lowerQuery.includes('single word') && lowerQuery.includes('palindromic')) {
        parsedFilters = { word_count: 1, is_palindrome: true };
    } else if (lowerQuery.includes('longer than') && lowerQuery.match(/(\d+)/)) {
        parsedFilters = { min_length: parseInt(lowerQuery.match(/(\d+)/)[1]) + 1 };
    } else if (lowerQuery.includes('contain') && lowerQuery.match(/[a-z]/)) {
        const char = lowerQuery.match(/[a-z]/)[0];
        parsedFilters = { contains_character: char };
    } else if (lowerQuery.includes('palindromic')) {
        parsedFilters = { is_palindrome: true };
    } else {
        return res.status(400).json({ error: 'Unable to parse query' });
    }
    
    // APPLY FILTERS
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

// 5. DELETE /strings/:value
app.delete('/strings/:value', (req, res) => {
    const hash = createHash(req.params.value);
    const index = stringDatabase.findIndex(s => s.id === hash);
    
    if (index === -1) return res.status(404).json({ error: 'String not found' });
    
    stringDatabase.splice(index, 1);
    res.status(204).send(); // FIXED: 204 NO CONTENT
});

// START SERVER
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});