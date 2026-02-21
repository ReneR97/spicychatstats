import fs from 'fs';
import axios from 'axios';

const BASE_URL = 'https://prod.nd-api.com/v2';
const BEARER_TOKEN = 'YOUR_BEARER_TOKEN_HERE';

const DELAY_MS = 250;
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

/**
 * Step 1: Fetch ALL conversations with pagination.
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

        // Find the entry with is_last_id: true (the last element)
        const lastEntry = conversations.find(c => c.is_last_id === true);
        if (lastEntry) {
            lastId = lastEntry.character_id;
        } else {
            // No more pages
            break;
        }

        // If we got fewer than 25, we've reached the end
        if (conversations.length < 25) break;

        page++;
        await sleep(DELAY_MS);
    }

    console.log(`  Total conversations fetched: ${allConversations.length}`);
    return allConversations;
}

/**
 * Step 2: For a character, fetch all their conversations with details.
 */
async function fetchCharacterConversations(characterId) {
    const url = `${BASE_URL}/characters/${characterId}/conversations?limit=100`;
    const response = await axios.get(url, { headers: HEADERS });
    const conversations = response.data;

    // Return conversation details: id, createdAt, message_count
    return conversations.map(c => ({
        id: c.id,
        createdAt: c.createdAt,
        message_count: c.message_count || c.num_messages || 0,
    }));
}

/**
 * Step 3: Fetch character details (we only need tags).
 */
async function fetchCharacterDetails(characterId) {
    const url = `${BASE_URL}/characters/${characterId}`;
    const response = await axios.get(url, { headers: HEADERS });
    return response.data;
}

/**
 * Main aggregation logic.
 */
async function aggregate() {
    console.log('=== SpicyChat Data Aggregator ===\n');

    // Step 1: Fetch all conversations
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
    console.log(`\n[Info] Found ${uniqueCharacters.length} unique characters.\n`);

    // Step 2 & 3: Enrich each character with message counts and tags
    const results = [];

    for (let i = 0; i < uniqueCharacters.length; i++) {
        const char = uniqueCharacters[i];
        console.log(`[Step 2+3] (${i + 1}/${uniqueCharacters.length}) Processing "${char.name}"...`);

        try {
            // Fetch conversation details
            const conversations = await fetchCharacterConversations(char.character_id);
            await sleep(DELAY_MS);

            // Fetch character tags
            const details = await fetchCharacterDetails(char.character_id);
            await sleep(DELAY_MS);

            results.push({
                character_id: char.character_id,
                name: char.name,
                title: char.title,
                avatar_url: char.avatar_url,
                tags: details.tags || [],
                conversations: conversations,
                message_counts: conversations.map(c => c.message_count),
                total_conversations: conversations.length,
            });

        } catch (error) {
            console.error(`  Error processing "${char.name}": ${error.message}`);
            // Still add the character with what we have
            results.push({
                character_id: char.character_id,
                name: char.name,
                title: char.title,
                avatar_url: char.avatar_url,
                tags: [],
                message_counts: [],
                total_conversations: 0,
                error: error.message,
            });
        }
    }

    // Step 4: Write output
    const outputPath = 'aggregated.json';
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n=== Done! Data saved to ${outputPath} ===`);
    console.log(`Total unique characters: ${results.length}`);
    console.log(`Total conversations: ${results.reduce((sum, r) => sum + r.total_conversations, 0)}`);
    console.log(`Total messages: ${results.reduce((sum, r) => sum + r.message_counts.reduce((a, b) => a + b, 0), 0)}`);
}

aggregate().catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});
