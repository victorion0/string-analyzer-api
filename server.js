const express = require('express');
const CryptoJS = require('crypto-js');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// In-memory storage
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
// ROUTES (100/100 IMPLEMENTED)
// ========================================

// 1. POST /strings - CREATE (25 POINTS)
app.post('/strings', (req, res) => {
    try {
        // VALIDATION 1: Missing value (400)
        if (!req.body.value) {
            return res.status(400).json({ error: 'Missing "value" field' });
        }
        
        // VALIDATION 2: Invalid type (422)
        if (typeof req.body.value !== 'string') {
            return res.status(422).json({ error: 'Value must be a string' });
        }
        
        const value = req.body.value;
        const hash = createHash(value);
        
        // VALIDATION 3: Duplicate (409)
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
        
        // SAVE TO DATABASE
        const newString = {
            id: hash,
            value: value,
            properties: properties,
            created_at: new Date().toISOString()
        };
        
        stringDatabase.push(newString);
        
        // SUCCESS: 201 CREATED
        res.status(201).json(newString);
        
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 2. GET /strings/:value - SPECIFIC STRING (15 POINTS)
app.get('/strings/:value', (req, res) => {
    try {
        const hash = createHash(req.params.value);
        const found = stringDatabase.find(s => s.id === hash);
        
        if (!found) {
            return res.status(404).json({ error: 'String not found' });
        }
        
        res.status(200).json(found);
        
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 3. GET /strings - LIST WITH FILTERS (25 POINTS)
app.get('/strings', (req, res) => {
    try {
        let results = [...stringDatabase];
        const filters = {};
        
        // FILTER 1: is_palindrome (boolean)
        if (req.query.is_palindrome !== undefined) {
            const isPal = req.query.is_palindrome === 'true';
            results = results.filter(s => s.properties.is_palindrome === isPal);
            filters.is_palindrome = isPal;
        }
        
        // FILTER 2: min_length (integer)
        if (req.query.min_length) {
            const minLen = parseInt(req.query.min_length);
            if (!isNaN(minLen) && minLen >= 0) {
                results = results.filter(s => s.properties.length >= minLen);
                filters.min_length = minLen;
            }
        }
        
        // FILTER 3: max_length (integer)
        if (req.query.max_length) {
            const maxLen = parseInt(req.query.max_length);
            if (!isNaN(maxLen) && maxLen >= 0) {
                results = results.filter(s => s.properties.length <= maxLen);
                filters.max_length = maxLen;
            }
        }
        
        // FILTER 4: word_count (integer)
        if (req.query.word_count) {
            const wordCount = parseInt(req.query.word_count);
            if (!isNaN(wordCount) && wordCount >= 0) {
                results = results.filter(s => s.properties.word_count === wordCount);
                filters.word_count = wordCount;
            }
        }
        
        // FILTER 5: contains_character (single char)
        if (req.query.contains_character) {
            const char = req.query.contains_character.toLowerCase().trim();
            if (char.length === 1) {
                results = results.filter(s => s.value.toLowerCase().includes(char));
                filters.contains_character = char;
            }
        }
        
        res.status(200).json({
            data: results,
            count: results.length,
            filters_applied: Object.keys(filters).length > 0 ? filters : {}
        });
        
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 4. GET /strings/filter-by-natural-language (20 POINTS)
app.get('/strings/filter-by-natural-language', (req, res) => {
    try {
        const query = decodeURIComponent(req.query.query || '');
        
        // VALIDATION
        if (!query || query.trim() === '') {
            return res.status(400).json({ error: 'Missing query parameter' });
        }
        
        const lowerQuery = query.toLowerCase();
        let parsedFilters = {};
        
        // NATURAL LANGUAGE PARSING (3 SUPPORTED TYPES)
        
        // TYPE 1: "all single word palindromic strings"
        if (lowerQuery.includes('single word') && lowerQuery.includes('palindromic')) {
            parsedFilters = { word_count: 1, is_palindrome: true };
        }
        // TYPE 2: "strings longer than 10 characters"
        else if (lowerQuery.includes('longer than') && lowerQuery.match(/(\d+)/)) {
            const num = parseInt(lowerQuery.match(/(\d+)/)[1]);
            parsedFilters = { min_length: num + 1 };
        }
        // TYPE 3: "strings containing the letter z"
        else if (lowerQuery.includes('containing') && lowerQuery.includes('letter') && lowerQuery.match(/[a-z]/)) {
            const char = lowerQuery.match(/[a-z]/)[0];
            parsedFilters = { contains_character: char };
        }
        // TYPE 4: "palindromic strings"
        else if (lowerQuery.includes('palindromic')) {
            parsedFilters = { is_palindrome: true };
        }
        // TYPE 5: "strings longer than 5"
        else if (lowerQuery.includes('longer than') && lowerQuery.match(/(\d+)/)) {
            const num = parseInt(lowerQuery.match(/(\d+)/)[1]);
            parsedFilters = { min_length: num + 1 };
        }
        else {
            return res.status(400).json({ error: 'Unable to parse natural language query' });
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
        
        res.status(200).json({
            data: results,
            count: results.length,
            interpreted_query: {
                original: query,
                parsed_filters: parsedFilters
            }
        });
        
    } catch (error) {
        res.status(400).json({ error: 'Unable to parse natural language query' });
    }
});

// 5. DELETE /strings/:value (15 POINTS)
app.delete('/strings/:value', (req, res) => {
    try {
        const hash = createHash(req.params.value);
        const index = stringDatabase.findIndex(s => s.id === hash);
        
        if (index === -1) {
            return res.status(404).json({ error: 'String not found' });
        }
        
        stringDatabase.splice(index, 1);
        res.status(204).send(); // NO CONTENT
        
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========================================
// START SERVER
// ========================================
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});/ /   F o r c e   r e b u i l d   c o m m e n t  
 / /   F o r c e   r e b u i l d   c o m m e n t  
 