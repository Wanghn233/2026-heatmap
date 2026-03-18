import { createClient } from "redis";

const redis = await createClient({ url: process.env.REDIS_URL }).connect();

const normalizeEvent = (input) => {
  if (typeof input === "string") {
    const text = input.trim();
    if (!text) return null;
    return {
      id: Date.now(),
      text,
      status: "todo",
    };
  }

  if (!input || typeof input !== "object") return null;

  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (!text) return null;

  const status =
    input.status === "done" ||
    input.status === "todo" ||
    input.status === "giveup" ||
    input.status === "meta"
      ? input.status
      : "todo";

  return {
    id: input.id ?? Date.now(),
    text,
    status,
  };
};

export default async function handler(request, response) {
  const DB_KEY = "year_2026_events";
  const APP_PASSWORD = process.env.APP_PASSWORD;

  // 1. Security Check
  if (APP_PASSWORD) {
    const authHeader = request.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token !== APP_PASSWORD) {
      return response.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    if (request.method === "GET") {
      const rawData = await redis.hGetAll(DB_KEY);
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
    } else if (request.method === "POST") {
      const { date, events, event } = request.body;
      if (!date) {
        return response.status(400).json({ error: "Invalid data format" });
      }

      if (Array.isArray(events)) {
        await redis.hSet(DB_KEY, date, JSON.stringify(events));
        return response.status(200).json({ success: true, mode: "replace" });
      }

      if (event !== undefined) {
        const normalizedEvent = normalizeEvent(event);
        if (!normalizedEvent) {
          return response.status(400).json({ error: "Invalid event format" });
        }

        const currentEventsRaw = await redis.hGet(DB_KEY, date);
        let currentEvents = [];

        if (currentEventsRaw) {
          try {
            currentEvents = JSON.parse(currentEventsRaw);
            if (!Array.isArray(currentEvents)) currentEvents = [];
          } catch (e) {
            currentEvents = [];
          }
        }

        currentEvents.push(normalizedEvent);
        await redis.hSet(DB_KEY, date, JSON.stringify(currentEvents));
        return response
          .status(200)
          .json({ success: true, mode: "append", event: normalizedEvent });
      }

      return response.status(400).json({ error: "Invalid data format" });
    } else {
      return response.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("API Handler Error:", error);
    return response.status(500).json({ error: "Internal Server Error" });
  }
}
