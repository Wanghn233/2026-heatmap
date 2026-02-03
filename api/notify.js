import { createClient } from "redis";

const redis = await createClient({ url: process.env.REDIS_URL }).connect();

const DB_KEY = "year_2026_events";
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

const holidays = {
  "2026-01-01": "元旦",
  "2026-01-02": "元旦",
  "2026-01-03": "元旦",
  "2026-02-15": "春节",
  "2026-02-16": "春节",
  "2026-02-17": "春节",
  "2026-02-18": "春节",
  "2026-02-19": "春节",
  "2026-02-20": "春节",
  "2026-02-21": "春节",
  "2026-02-22": "春节",
  "2026-02-23": "春节",
  "2026-04-04": "清明节",
  "2026-04-05": "清明节",
  "2026-04-06": "清明节",
  "2026-05-01": "劳动节",
  "2026-05-02": "劳动节",
  "2026-05-03": "劳动节",
  "2026-05-04": "劳动节",
  "2026-05-05": "劳动节",
  "2026-06-19": "端午节",
  "2026-06-20": "端午节",
  "2026-06-21": "端午节",
  "2026-09-25": "中秋节",
  "2026-09-26": "中秋节",
  "2026-09-27": "中秋节",
  "2026-10-01": "国庆节",
  "2026-10-02": "国庆节",
  "2026-10-03": "国庆节",
  "2026-10-04": "国庆节",
  "2026-10-05": "国庆节",
  "2026-10-06": "国庆节",
  "2026-10-07": "国庆节",
};

const weekdayMap = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const pad2 = (n) => String(n).padStart(2, "0");

const formatDateUTC = (date) =>
  `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;

const addDaysToYmd = (ymd, days) => {
  const [y, m, d] = ymd.split("-").map(Number);
  const ts = Date.UTC(y, m - 1, d) + days * 86400000;
  return formatDateUTC(new Date(ts));
};

const getNowCST = () => new Date(Date.now() + TZ_OFFSET_MS);

const getNowCSTString = () => {
  const now = getNowCST();
  return `${formatDateUTC(now)} ${pad2(now.getUTCHours())}:${pad2(now.getUTCMinutes())}:${pad2(
    now.getUTCSeconds(),
  )} (UTC+8)`;
};

const extractTasks = (events = []) => {
  const list = events.filter((e) => e.status !== "meta");
  return {
    todo: list.filter((e) => e.status === "todo").map((e) => e.text),
    done: list.filter((e) => e.status === "done").map((e) => e.text),
    giveup: list.filter((e) => e.status === "giveup").map((e) => e.text),
  };
};

const buildPrompt = (mode, payload) => {
  const role =
    mode === "evening"
      ? "你是温柔而务实的晚间复盘助手。用中文给出简洁复盘与明日关注。"
      : "你是温柔而务实的早间计划助手。用中文给出简洁可执行的今日安排。";

  return {
    system:
      `${role}` +
      `输出要求：不超过8行，使用短句/要点；保留任务原文；不要发散，不要编造；` +
      `语气关怀但克制，不说空话；可给出1句鼓励或提醒；` +
      `任务名称必须使用「」包裹。\n\n` +
      `请根据模式输出：\n` +
      `- 早上：用自然语气串联当日、积压与未来3天；先提节假日影响，再说今日重点与积压提醒，最后加一句鼓励；提到的任务不要省略；任务名称用「」包裹。\n` +
      `- 晚上：用自然语气回顾今日完成/未完成，并给出迁移建议，最后加一句肯定；提到的任务不要省略；任务名称用「」包裹。\n` +
      `- 严格只输出当前模式的内容，不要同时输出早上与晚上的内容，不要出现“早上/晚上/复盘/计划”字样。\n\n` +
      `完整示例（仅参考结构与语气，勿照抄）：\n` +
      `【输入-早上】\n` +
      "```\n" +
      `当前时间（UTC+8）：2026-02-02 08:05:00 (UTC+8)\n` +
      `今日：2026-02-15 周日（节假日：春节）\n` +
      `前7天未完成（todo）任务：\n` +
      `- 2026-01-30: 「体检预约」；「预算复盘」\n` +
      `- 2026-01-31: 无\n` +
      `- 2026-02-01: 「读书30页」\n` +
      `今日全部任务：\n` +
      `- todo: 「给爸妈打电话」；「整理报销」\n` +
      `- done: 无\n` +
      `- giveup: 无\n` +
      `后3天任务（todo）：\n` +
      `- 2026-02-03: 「会议材料初稿」\n` +
      `- 2026-02-04: 无\n` +
      `- 2026-02-05: 「复盘项目里程碑」\n` +
      "```\n" +
      `【输出-早上】\n` +
      "```\n" +
      `今天是 2026-02-15 周日，今天是春节假期，好好休息，享受假期。\n` +
      `今日重点：工作虽然繁忙，也别忘了「给爸妈打电话」哦，还要记得「整理报销」。\n` +
      `看看前几天：「体检预约」怎么还没有预约呀，是忘记了吗？「预算复盘」也该开始了，别忘了自己定的目标「读书30页」哟。\n` +
      `后面几天：「会议材料初稿」可以提前起个头，「复盘项目里程碑」先列个框架。\n` +
      `\n做完一件也算进步。\n` +
      "```\n" +
      `【输入-晚上】\n` +
      "```\n" +
      `当前时间（UTC+8）：2026-02-02 21:15:00 (UTC+8)\n` +
      `今日：2026-02-02 周一（节假日：春节）\n` +
      `前7天未完成（todo）任务：\n` +
      `- 2026-01-30: 「体检预约」；「预算复盘」\n` +
      `- 2026-02-01: 「读书30页」\n` +
      `今日全部任务：\n` +
      `- todo: 「整理报销」\n` +
      `- done: 「给爸妈打电话」\n` +
      `- giveup: 无\n` +
      `后3天任务（todo）：\n` +
      `- 2026-02-03: 「会议材料初稿」\n` +
      `- 2026-02-05: 「复盘项目里程碑」\n` +
      "```\n" +
      `【输出-晚上】\n` +
      "```\n" +
      `今天是 2026-02-02 周一，春节假期里也有好好照顾到家人，挺棒的。\n` +
      `已完成：「给爸妈打电话」。\n` +
      `未完成：「整理报销」可以放到明早优先处理。\n` +
      `前几天：「体检预约」和「预算复盘」别忘了安排到本周。\n` +
      `后面几天：「会议材料初稿」先把框架搭起来，「复盘项目里程碑」先列个提纲。\n` +
      `\n你已经做得不错了，早点休息。\n` +
      "```",
    user:
      `当前时间（UTC+8）：${payload.now}\n` +
      `今日：${payload.today.date} ${payload.today.weekday}${
        payload.today.holiday ? `（节假日：${payload.today.holiday}）` : ""
      }\n` +
      `模式：${mode === "evening" ? "晚间复盘" : "早间计划"}\n\n` +
      `前7天未完成（todo）任务：\n${payload.past7
        .map((d) => {
          const todoText = d.todo.length
            ? d.todo.map((t) => `「${t}」`).join("；")
            : "无";
          return `- ${d.date}${d.holiday ? `(${d.holiday})` : ""}: ${todoText}`;
        })
        .join("\n")}\n\n` +
      `今日全部任务：\n` +
      `- todo: ${
        payload.today.tasks.todo.length
          ? payload.today.tasks.todo.map((t) => `「${t}」`).join("；")
          : "无"
      }\n` +
      `- done: ${
        payload.today.tasks.done.length
          ? payload.today.tasks.done.map((t) => `「${t}」`).join("；")
          : "无"
      }\n` +
      `- giveup: ${
        payload.today.tasks.giveup.length
          ? payload.today.tasks.giveup.map((t) => `「${t}」`).join("；")
          : "无"
      }\n\n` +
      `后3天任务（todo）：\n${payload.next3
        .map((d) => {
          const todoText = d.todo.length
            ? d.todo.map((t) => `「${t}」`).join("；")
            : "无";
          return `- ${d.date}${d.holiday ? `(${d.holiday})` : ""}: ${todoText}`;
        })
        .join("\n")}\n\n`,
  };
};

const buildAiUrl = (base) => {
  const trimmed = base.replace(/\/+$/, "");
  if (trimmed.endsWith("/v1")) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
};

const callAI = async ({ baseUrl, apiKey, model, mode, payload }) => {
  const prompt = buildPrompt(mode, payload);
  const res = await fetch(buildAiUrl(baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    throw new Error(`AI request failed: ${res.status}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
};

const sendWeCom = async (webhookUrl, content) => {
  return fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      msgtype: "text",
      text: { content },
    }),
  });
};

export default async function handler(request, response) {
  const APP_PASSWORD = process.env.APP_PASSWORD;
  if (APP_PASSWORD) {
    const authHeader = request.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (token !== APP_PASSWORD) {
      return response.status(401).json({ error: "Unauthorized" });
    }
  }

  const webhookUrl = process.env.WEBHOOK_URL;
  const baseUrl = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;

  if (!webhookUrl || !baseUrl || !apiKey || !model) {
    return response.status(500).json({ error: "Missing required env vars" });
  }

  try {
    const rawData = await redis.hGetAll(DB_KEY);
    const eventsData = {};
    if (rawData) {
      for (const [date, eventsStr] of Object.entries(rawData)) {
        try {
          eventsData[date] = JSON.parse(eventsStr);
        } catch {
          eventsData[date] = [];
        }
      }
    }

    const nowCST = getNowCST();
    const today = formatDateUTC(nowCST);
    const hourCST = nowCST.getUTCHours();
    const normalizedMode = hourCST < 12 ? "morning" : "evening";

    const past7 = [];
    for (let i = 7; i >= 1; i -= 1) {
      const date = addDaysToYmd(today, -i);
      const tasks = extractTasks(eventsData[date] || []);
      past7.push({
        date,
        holiday: holidays[date],
        todo: tasks.todo,
      });
    }

    const todayTasks = extractTasks(eventsData[today] || []);

    const next3 = [];
    for (let i = 1; i <= 3; i += 1) {
      const date = addDaysToYmd(today, i);
      const tasks = extractTasks(eventsData[date] || []);
      next3.push({
        date,
        holiday: holidays[date],
        todo: tasks.todo,
      });
    }

    const payload = {
      now: getNowCSTString(),
      today: {
        date: today,
        weekday:
          weekdayMap[
            new Date(
              Date.UTC(
                Number(today.slice(0, 4)),
                Number(today.slice(5, 7)) - 1,
                Number(today.slice(8, 10)),
              ),
            ).getUTCDay()
          ],
        holiday: holidays[today],
        tasks: todayTasks,
      },
      past7,
      next3,
    };

    let aiContent = "";
    try {
      aiContent = await callAI({
        baseUrl,
        apiKey,
        model,
        mode: normalizedMode,
        payload,
      });
    } catch (err) {
      console.warn("AI call failed, fallback to local summary:", err);
    }

    const fallbackContent =
      `当前时间：${payload.now}\n` +
      `今日${payload.today.date} ${payload.today.weekday} ${
        payload.today.holiday ? `（节假日：${payload.today.holiday}）` : ""
      }\n` +
      `todo: ${
        payload.today.tasks.todo.length
          ? payload.today.tasks.todo.map((t) => `「${t}」`).join("；")
          : "无"
      }\n` +
      `done: ${
        payload.today.tasks.done.length
          ? payload.today.tasks.done.map((t) => `「${t}」`).join("；")
          : "无"
      }\n` +
      `giveup: ${
        payload.today.tasks.giveup.length
          ? payload.today.tasks.giveup.map((t) => `「${t}」`).join("；")
          : "无"
      }\n` +
      (normalizedMode === "evening"
        ? "今天辛苦了，哪怕只完成一点也值得肯定。"
        : "早安，今天我们从最重要的一件事开始。");

    const finalContent = aiContent || fallbackContent;

    const pushRes = await sendWeCom(webhookUrl, finalContent);
    if (!pushRes.ok) {
      return response.status(500).json({ error: "Failed to send webhook" });
    }

    return response.status(200).json({ success: true });
  } catch (error) {
    console.error("Notify Error:", error);
    return response.status(500).json({ error: "Internal Server Error" });
  }
}
