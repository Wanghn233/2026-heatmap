import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    // Key for our hash in Redis
    const DB_KEY = 'year_2026_events';
    const APP_PASSWORD = process.env.APP_PASSWORD;

    // 1. Security Check
    // If APP_PASSWORD is set in env, we enforce it.
    if (APP_PASSWORD) {
        const authHeader = request.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

        if (token !== APP_PASSWORD) {
            return response.status(401).json({ error: 'Unauthorized: Invalid Password' });
        }
    }

    // Allow CORS helper for local dev to prod API cases (optional but good practice)
    /* 
    response.setHeader('Access-Control-Allow-Credentials', true)
    response.setHeader('Access-Control-Allow-Origin', '*')
    // ...
    */

    try {
        if (request.method === 'GET') {
            // 2. Fetch all data to render the heatmap
            const data = await kv.hgetall(DB_KEY);
            return response.status(200).json(data || {});
        }

        else if (request.method === 'POST') {
            // 3. Update specific date (Optimized for performance)
            const { date, events } = request.body;

            if (!date || !Array.isArray(events)) {
                return response.status(400).json({ error: 'Invalid data format' });
            }

            // Save to Redis Hash
            await kv.hset(DB_KEY, { [date]: events });

            return response.status(200).json({ success: true });
        }

        else {
            return response.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
