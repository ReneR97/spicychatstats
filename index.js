import fs from 'fs';
import axios from 'axios';

// =============================================
// CONFIGURATION
// =============================================

const BASE_URL = 'https://prod.nd-api.com/v2';
const BEARER_TOKEN = '';



const DELAY_MS = 200;
const OUTPUT_PATH = 'aggregated.json';
const HEADERS = {
    'Authorization': `Bearer ${BEARER_TOKEN}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Referer': 'https://spicychat.ai/',
    'Origin': 'https://spicychat.ai'
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// =============================================
// API FUNCTIONS
// =============================================

/**
 * Fetch ALL conversations with pagination.
 * Returns a flat array of all conversation objects.
 */
async function fetchAllConversations() {
    const allConversations = [];
    let lastId = null;
    let page = 1;

    while (true) {
        let url = `${BASE_URL}/conversations?limit=25`;
        if (lastId) url += `&last_id=${lastId}`;

        console.log(`  Fetching conversations page ${page}...`);
        const response = await axios.get(url, { headers: HEADERS });
        const conversations = response.data;

        if (!conversations || conversations.length === 0) break;

        allConversations.push(...conversations);

        const lastEntry = conversations.find(c => c.is_last_id === true);
        if (lastEntry) {
            lastId = lastEntry.character_id;
        } else {
            break;
        }

        if (conversations.length < 25) break;

        page++;
        await sleep(DELAY_MS);
    }

    console.log(`  Total conversations fetched: ${allConversations.length}`);
    return allConversations;
}

/**
 * For a character, fetch all their conversations with details.
 */
async function fetchCharacterConversations(characterId) {
    const url = `${BASE_URL}/characters/${characterId}/conversations?limit=100`;
    const response = await axios.get(url, { headers: HEADERS });
    const conversations = response.data;

    return conversations.map(c => ({
        id: c.id,
        createdAt: c.createdAt,
        message_count: c.message_count || c.num_messages || 0,
    }));
}

/**
 * Fetch character details (tags, etc.).
 */
async function fetchCharacterDetails(characterId) {
    const url = `${BASE_URL}/characters/${characterId}`;
    const response = await axios.get(url, { headers: HEADERS });
    return response.data;
}

/**
 * Fully crawl a single character: conversations + details.
 */
async function crawlCharacter(char) {
    const conversations = await fetchCharacterConversations(char.character_id);
    await sleep(DELAY_MS);

    const details = await fetchCharacterDetails(char.character_id);
    await sleep(DELAY_MS);

    return {
        character_id: char.character_id,
        name: char.name,
        title: char.title,
        avatar_url: char.avatar_url,
        tags: details.tags || [],
        conversations: conversations,
        message_counts: conversations.map(c => c.message_count),
        total_conversations: conversations.length,
    };
}

// =============================================
// LOAD EXISTING DATA (for incremental mode)
// =============================================

function loadExistingData() {
    if (!fs.existsSync(OUTPUT_PATH)) return new Map();
    try {
        const raw = fs.readFileSync(OUTPUT_PATH, 'utf-8');
        const arr = JSON.parse(raw);
        const map = new Map();
        for (const entry of arr) {
            map.set(entry.character_id, entry);
        }
        console.log(`  Loaded ${map.size} existing characters from ${OUTPUT_PATH}`);
        return map;
    } catch (err) {
        console.warn(`  Could not load existing data: ${err.message}`);
        return new Map();
    }
}

// =============================================
// MAIN AGGREGATION
// =============================================

async function aggregate() {
    console.log('=== SpicyChat Data Aggregator ===\n');

    // Step 1: Fetch all conversations from the API
    console.log('[Step 1] Fetching all conversations...');
    const allConversations = await fetchAllConversations();

    // Deduplicate by character_id — collect unique characters
    const characterMap = new Map();
    for (const conv of allConversations) {
        const charId = conv.character_id;
        if (!characterMap.has(charId)) {
            characterMap.set(charId, {
                character_id: charId,
                name: conv.character?.name || 'Unknown',
                title: conv.character?.title || '',
                avatar_url: conv.character?.avatar_url || '',
            });
        }
    }

    const uniqueCharacters = Array.from(characterMap.values());
    console.log(`\n[Info] Found ${uniqueCharacters.length} unique characters from the API.\n`);

    // Load existing data (auto-detects: if aggregated.json exists, runs incrementally)
    const existingData = loadExistingData();
    const isIncremental = existingData.size > 0;

    // Stats counters
    let skipped = 0;
    let updated = 0;
    let added = 0;

    // Step 2 & 3: Process each character
    const results = [];

    for (let i = 0; i < uniqueCharacters.length; i++) {
        const char = uniqueCharacters[i];
        const existing = existingData.get(char.character_id);
        const label = `(${i + 1}/${uniqueCharacters.length})`;

        try {
            if (!existing) {
                // New character (or first run) — full crawl
                if (isIncremental) {
                    console.log(`  ${label} ✨ New character "${char.name}" — crawling...`);
                    added++;
                } else {
                    console.log(`  ${label} Processing "${char.name}"...`);
                }
                results.push(await crawlCharacter(char));

            } else {
                // Existing character — check for new conversations
                const freshConvs = await fetchCharacterConversations(char.character_id);
                await sleep(DELAY_MS);

                // Compare conversation IDs with stored ones
                const storedIds = new Set((existing.conversations || []).map(c => c.id));
                const freshIds = new Set(freshConvs.map(c => c.id));
                const hasNewConvs = freshConvs.some(c => !storedIds.has(c.id)) || freshIds.size !== storedIds.size;

                if (!hasNewConvs) {
                    // Same conversations → skip
                    console.log(`  ${label} ⏭  Skipping "${char.name}" (${storedIds.size} convos, unchanged)`);
                    results.push(existing);
                    skipped++;
                } else {
                    // New or different conversations → recrawl details too
                    console.log(`  ${label} 🔄 Updating "${char.name}" (${storedIds.size} → ${freshIds.size} convos)`);
                    const details = await fetchCharacterDetails(char.character_id);
                    await sleep(DELAY_MS);

                    results.push({
                        character_id: char.character_id,
                        name: char.name,
                        title: char.title,
                        avatar_url: char.avatar_url,
                        tags: details.tags || [],
                        conversations: freshConvs,
                        message_counts: freshConvs.map(c => c.message_count),
                        total_conversations: freshConvs.length,
                    });
                    updated++;
                }
            }
        } catch (error) {
            console.error(`  ${label} ❌ Error with "${char.name}": ${error.message}`);
            if (existing) {
                results.push(existing);
            } else {
                results.push({
                    character_id: char.character_id,
                    name: char.name,
                    title: char.title,
                    avatar_url: char.avatar_url,
                    tags: [],
                    conversations: [],
                    message_counts: [],
                    total_conversations: 0,
                    error: error.message,
                });
            }
        }
    }

    // Step 4: Write output
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));

    console.log(`\n=== Done! Data saved to ${OUTPUT_PATH} ===`);
    console.log(`Total unique characters: ${results.length}`);
    console.log(`Total conversations: ${results.reduce((sum, r) => sum + r.total_conversations, 0)}`);
    console.log(`Total messages: ${results.reduce((sum, r) => sum + (r.message_counts || []).reduce((a, b) => a + b, 0), 0)}`);

    if (isIncremental) {
        console.log(`\n── Incremental summary ──`);
        console.log(`  ✨ New:       ${added}`);
        console.log(`  🔄 Updated:   ${updated}`);
        console.log(`  ⏭  Skipped:   ${skipped}`);
    }
}

aggregate().catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});
