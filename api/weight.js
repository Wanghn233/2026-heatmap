import { createClient } from "redis";

const redis = await createClient({ url: process.env.REDIS_URL }).connect();

const APP_PASSWORD = process.env.APP_PASSWORD;
const DB_INDEX_KEY = "year_weight_records:index";
const DB_DATA_KEY = "year_weight_records:data";
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

const pad2 = (n) => String(n).padStart(2, "0");

const getNowCST = () => new Date(Date.now() + TZ_OFFSET_MS);

const toCstParts = (date) => ({
  date: `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`,
  time: `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}`,
  hour: date.getUTCHours(),
});

const inferTimeSlot = (hour) => {
  if (hour >= 4 && hour < 12) return "morning";
  if (hour >= 17 && hour < 24) return "evening";
  return "other";
};

const checkAuth = (request, response) => {
  if (!APP_PASSWORD) return true;

  const authHeader = request.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token !== APP_PASSWORD) {
    response.status(401).json({ error: "Unauthorized" });
    return false;
  }

  return true;
};

const parsePositiveNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const parseOptionalPositiveNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  return parsePositiveNumber(value);
};

const normalizeSource = (value) =>
  value === "manual_add" || value === "manual_edit" ? value : "auto_push";

const isValidDateValue = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

const isValidTimeValue = (value) =>
  typeof value === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(value);

const buildMeasuredTimestamp = (date, time) => {
  if (!isValidDateValue(date) || !isValidTimeValue(time)) return null;
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  const isoLike = `${date}T${normalizedTime}+08:00`;
  const measuredAtMs = Date.parse(isoLike);
  if (!Number.isFinite(measuredAtMs)) return null;
  return {
    measuredAtMs,
    measuredAt: new Date(measuredAtMs).toISOString(),
    measuredDate: date,
    measuredTime: normalizedTime,
    measuredHour: Number(normalizedTime.slice(0, 2)),
  };
};

const buildMeasuredFields = ({ measuredAt, measuredDate, measuredTime }) => {
  if (measuredAt) {
    const date = new Date(measuredAt);
    if (Number.isFinite(date.getTime())) {
      const cstDate = new Date(date.getTime() + TZ_OFFSET_MS);
      const parts = toCstParts(cstDate);
      return {
        measuredAt: date.toISOString(),
        measuredAtMs: date.getTime(),
        measuredDate: parts.date,
        measuredTime: parts.time,
        timeSlot: inferTimeSlot(parts.hour),
      };
    }
  }

  const built = buildMeasuredTimestamp(measuredDate, measuredTime);
  if (!built) return null;
  return {
    measuredAt: built.measuredAt,
    measuredAtMs: built.measuredAtMs,
    measuredDate: built.measuredDate,
    measuredTime: built.measuredTime,
    timeSlot: inferTimeSlot(built.measuredHour),
  };
};

const normalizeRecord = (record) => ({
  ...record,
  weightKg: Number(record.weightKg),
  impedance: record.impedance == null ? null : Number(record.impedance),
  receivedAtMs: Number(record.receivedAtMs),
  measuredAtMs: Number(record.measuredAtMs),
  measuredAt: record.measuredAt,
  measuredDate: record.measuredDate,
  measuredTime: record.measuredTime,
  timeSlot: record.timeSlot,
});

const saveRecord = async ({ weightKg, impedance, measuredAt, measuredDate, measuredTime, source }) => {
  const now = getNowCST();
  const receivedAtMs = Date.now();
  const { date, time } = toCstParts(now);
  const recordId = `w_${receivedAtMs}`;
  const measuredFields = buildMeasuredFields({
    measuredAt: measuredAt || new Date(receivedAtMs).toISOString(),
    measuredDate: measuredDate || date,
    measuredTime: measuredTime || time,
  });
  if (!measuredFields) {
    throw new Error("Invalid measured datetime");
  }

  const record = {
    id: recordId,
    userId: null,
    source: normalizeSource(source),
    weightKg,
    impedance,
    receivedAt: new Date(receivedAtMs).toISOString(),
    receivedAtMs,
    receivedDate: date,
    receivedTime: time,
    ...measuredFields,
  };

  await redis.hSet(DB_DATA_KEY, recordId, JSON.stringify(record));
  await redis.zAdd(DB_INDEX_KEY, { score: receivedAtMs, value: recordId });

  return record;
};

const getRecordById = async (recordId) => {
  if (!recordId) return null;
  const raw = await redis.hGet(DB_DATA_KEY, recordId);
  if (!raw) return null;
  try {
    return normalizeRecord(JSON.parse(raw));
  } catch (error) {
    return null;
  }
};

const updateRecord = async (recordId, updates) => {
  const current = await getRecordById(recordId);
  if (!current) return null;

  const nextWeightKg =
    updates.weightKg === undefined ? current.weightKg : parsePositiveNumber(updates.weightKg);
  const nextImpedance =
    updates.impedance === undefined
      ? current.impedance
      : parseOptionalPositiveNumber(updates.impedance);

  if (!nextWeightKg) return false;

  const measuredFields = buildMeasuredFields({
    measuredAt: updates.measuredAt,
    measuredDate: updates.measuredDate ?? current.measuredDate,
    measuredTime: updates.measuredTime ?? current.measuredTime,
  });
  if (!measuredFields) return false;

  const record = {
    ...current,
    weightKg: nextWeightKg,
    impedance: nextImpedance,
    source: "manual_edit",
    ...measuredFields,
  };

  await redis.hSet(DB_DATA_KEY, recordId, JSON.stringify(record));
  return normalizeRecord(record);
};

const deleteRecord = async (recordId) => {
  const current = await getRecordById(recordId);
  if (!current) return false;
  await redis.hDel(DB_DATA_KEY, recordId);
  await redis.zRem(DB_INDEX_KEY, recordId);
  return true;
};

const listRecords = async (limit) => {
  const total = await redis.zCard(DB_INDEX_KEY);
  if (total === 0) return [];

  const end = Math.max(total - 1, 0);
  const start = Math.max(end - limit + 1, 0);
  const ids = await redis.zRange(DB_INDEX_KEY, start, end, { REV: true });
  if (!ids.length) return [];

  const rawRecords = await redis.hmGet(DB_DATA_KEY, ids);
  return rawRecords
    .map((item) => {
      if (!item) return null;
      try {
        return normalizeRecord(JSON.parse(item));
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
};

export default async function handler(request, response) {
  if (!checkAuth(request, response)) return;

  try {
    if (request.method === "POST") {
      const weightKg = parsePositiveNumber(
        request.body?.weightKg ?? request.body?.weight,
      );
      const impedance = parseOptionalPositiveNumber(request.body?.impedance);

      if (!weightKg) {
        return response.status(400).json({
          error: "Invalid payload",
          expected: {
            weightKg: "positive number",
            impedance: "optional positive number",
          },
        });
      }

      const record = await saveRecord({
        weightKg,
        impedance,
        measuredAt: request.body?.measuredAt,
        measuredDate: request.body?.measuredDate,
        measuredTime: request.body?.measuredTime,
        source: request.body?.source,
      });
      return response.status(201).json({
        success: true,
        record: normalizeRecord(record),
      });
    }

    if (request.method === "GET") {
      const limit = Math.min(
        Math.max(Number(request.query?.limit) || 50, 1),
        500,
      );
      const records = await listRecords(limit);
      return response.status(200).json({
        records,
        count: records.length,
      });
    }

    if (request.method === "PATCH") {
      const recordId = request.query?.id || request.body?.id;
      if (!recordId) {
        return response.status(400).json({ error: "Missing record id" });
      }

      const updated = await updateRecord(recordId, request.body || {});
      if (updated === false) {
        return response.status(400).json({
          error: "Invalid payload",
          expected: {
            weightKg: "positive number",
            impedance: "optional positive number",
            measuredDate: "YYYY-MM-DD",
            measuredTime: "HH:mm or HH:mm:ss",
          },
        });
      }
      if (!updated) {
        return response.status(404).json({ error: "Record not found" });
      }

      return response.status(200).json({ success: true, record: updated });
    }

    if (request.method === "DELETE") {
      const recordId = request.query?.id || request.body?.id;
      if (!recordId) {
        return response.status(400).json({ error: "Missing record id" });
      }
      const deleted = await deleteRecord(recordId);
      if (!deleted) {
        return response.status(404).json({ error: "Record not found" });
      }
      return response.status(200).json({ success: true, id: recordId });
    }

    return response.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Weight API Handler Error:", error);
    return response.status(500).json({ error: "Internal Server Error" });
  }
}
