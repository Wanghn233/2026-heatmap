import { createClient } from 'redis';

// Initialize Redis Client Globally (Reuse connection)
const client = createClient();

client.on('error', (err) => console.error('Redis Client Error', err));

// Connect to Redis (Top-level await)
await client.connect();

export default async function handler(request, response) {
    const DB_KEY = 'year_2026_events';
    const APP_PASSWORD = process.env.APP_PASSWORD;

    // 1. Security Check
    if (APP_PASSWORD) {
        const authHeader = request.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token !== APP_PASSWORD) {
            return response.status(401).json({ error: 'Unauthorized' });
        }
    }

    try {
        if (request.method === 'GET') {
            const rawData = await client.hGetAll(DB_KEY);
            const parsedData = {};

            if (rawData) {
                for (const [date, eventsStr] of Object.entries(rawData)) {
                    try {
                        parsedData[date] = JSON.parse(eventsStr);
                    } catch (e) {
                        parsedData[date] = [];
                    }
                }
            }
            return response.status(200).json(parsedData);
        }

        else if (request.method === 'POST') {
            const { date, events } = request.body;
            if (!date || !Array.isArray(events)) {
                return response.status(400).json({ error: 'Invalid data format' });
            }

            await client.hSet(DB_KEY, date, JSON.stringify(events));
            return response.status(200).json({ success: true });
        }

        else {
            return response.status(405).json({ error: 'Method not allowed' });
        }

    } catch (error) {
        console.error('API Handler Error:', error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
