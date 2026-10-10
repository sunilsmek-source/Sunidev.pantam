import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);
const maxBodyBytes = 1024 * 1024;
const openAiResponsesUrl = "https://api.openai.com/v1/responses";
const chatModel = "gpt-6-luna";
const localGoogleSheetsWebhookUrl = "https://script.google.com/macros/s/AKfycby7p4KvsL-t6jqTuV6bIg9f4ntXdfWIJBIJvVxhYmWjr_DCDkNeqiWDOjp9YiAzy8U/exec";

async function loadLocalEnv() {
  try {
    const source = await readFile(join(root, ".env"), "utf8");
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || process.env[match[1]]) continue;
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

await loadLocalEnv();

const isVercel = Boolean(process.env.VERCEL);
const googleSheetsWebhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL || (isVercel ? "" : localGoogleSheetsWebhookUrl);

const publicFiles = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/AI with homepage.html", "AI with homepage.html"],
  ["/pantomic_logo.svg", "pantomic_logo.svg"]
]);

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(value));
}

function checkOrigin(request) {
  if (request.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.host === request.headers.host;
  } catch {
    return false;
  }
}

function allowRequest(request, response) {
  if (!checkOrigin(request)) {
    sendJson(response, 403, { error: "This request was blocked by the same-origin policy." });
    return false;
  }
  return true;
}

async function readJson(request) {
  const contentType = request.headers["content-type"] || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw Object.assign(new Error("Content-Type must be application/json."), { status: 415 });
  }

  let frameworkBody;
  try {
    frameworkBody = request.body;
  } catch {
    throw Object.assign(new Error("The request body must be valid JSON."), { status: 400 });
  }
  if (frameworkBody !== undefined && frameworkBody !== null) {
    if (Buffer.byteLength(JSON.stringify(frameworkBody)) > maxBodyBytes) {
      throw Object.assign(new Error("The request is too large."), { status: 413 });
    }
    if (typeof frameworkBody === "object" && !Buffer.isBuffer(frameworkBody)) return frameworkBody;
    const bodyText = Buffer.isBuffer(frameworkBody) ? frameworkBody.toString("utf8") : String(frameworkBody);
    try {
      return JSON.parse(bodyText);
    } catch {
      throw Object.assign(new Error("The request body must be valid JSON."), { status: 400 });
    }
  }

  const declaredLength = Number(request.headers["content-length"] || 0);
  if (declaredLength > maxBodyBytes) {
    throw Object.assign(new Error("The request is too large."), { status: 413 });
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      throw Object.assign(new Error("The request is too large."), { status: 413 });
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("The request body must be valid JSON."), { status: 400 });
  }
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 30) {
    throw Object.assign(new Error("A chat request must include between 1 and 30 messages."), { status: 400 });
  }

  return messages.map(message => {
    if (!message || !["system", "developer", "user", "assistant"].includes(message.role)) {
      throw Object.assign(new Error("A chat message has an unsupported role."), { status: 400 });
    }
    if (typeof message.content !== "string") {
      throw Object.assign(new Error("Text-only chat messages are required."), { status: 400 });
    }
    return { role: message.role, content: message.content.slice(0, 40_000) };
  });
}

function requiresFreshWebSearch(messages) {
  const latestUserMessage = [...messages].reverse().find(message => message.role === "user");
  if (!latestUserMessage) return false;
  const prompt = latestUserMessage.content.toLowerCase();

  const freshnessIntent = /\b(today|tonight|now|live|real[\s-]?time|current|latest|recent|breaking|this week|last (?:day|week|month)|market open|pre[ -]?market|after[ -]?hours|aaj|abhi|filhaal|taaza|taza|iss waqt|is waqt)\b/i;
  const newsIntent = /\b(news|headlines?|market updates?|stock updates?|updates?|samachar|khabar)\b/i;
  const marketAsset = /\b(market|index|nifty|sensex|bank nifty|stock|share|bitcoin|crypto|forex|gold|silver|crude|nasdaq|dow\s*jones?|dowjones?|djia|dj\s*30|s\s*&\s*p 500)\b/i;
  const marketStatusIntent = /\b(price|rate|quote|level|status|performance|gainers?|losers?|trading at|trend|position|kitne|chal raha|chal rahi|kya chal|kaisa|kaisi|haal)\b/i;

  return freshnessIntent.test(prompt) || newsIntent.test(prompt) || (marketAsset.test(prompt) && marketStatusIntent.test(prompt));
}

function hideSourceReferences(value) {
  return String(value || "")
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/gi, "")
    .replace(/\b(?:according to|as per|source|sources|reference|references|via|reported by)\s*:?\s*(?:the\s+)?(?:www\.)?(?:[a-z\d-]+\.)+[a-z]{2,}(?:\.[a-z]{2})?\b/gi, "")
    .replace(/https?:\/\/[^\s<>()\]]+/gi, "")
    .replace(/\b(?:www\.)?(?:[a-z\d-]+\.)+[a-z]{2,}(?:\.[a-z]{2})?\b/gi, "")
    .replace(/【[^】]*】|\[\d{1,2}\]/g, "")
    .replace(/^\s*(?:[-*•]\s*)?(?:sources?|references?|web search sources?)\s*:?\s*$/gim, "")
    .replace(/^\s*[-*•]\s*$/gm, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([.!?]){2,}/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractOutput(data) {
  const textParts = (data.output || [])
    .filter(item => item.type === "message")
    .flatMap(item => item.content || [])
    .filter(part => part.type === "output_text" && typeof part.text === "string");
  const text = textParts.map(part => part.text).join("\n") || (typeof data.output_text === "string" ? data.output_text : "");
  return hideSourceReferences(text);
}

async function callOpenAI(body) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error("OpenAI is not configured on the server. Set OPENAI_API_KEY and restart it."), { status: 503 });
  }

  let upstream;
  try {
    upstream = await fetch(openAiResponsesUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(isVercel ? 55_000 : 150_000)
    });
  } catch (error) {
    const message = error?.name === "TimeoutError" ? "The AI request timed out. Please try again." : "Could not connect to OpenAI. Please try again.";
    throw Object.assign(new Error(message), { status: 502 });
  }

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const upstreamMessage = data?.error?.message;
    const message = upstream.status === 401 || upstream.status === 403
      ? "OpenAI rejected the server API key. Update OPENAI_API_KEY and restart the server."
      : upstream.status === 429
        ? "OpenAI usage or rate limit reached. Check the API project's billing and limits."
        : typeof upstreamMessage === "string"
          ? upstreamMessage.replace(/\bsk-[A-Za-z0-9_-]{6,}/g, "[redacted]").slice(0, 500)
          : "OpenAI could not complete this request.";
    throw Object.assign(new Error(message), { status: upstream.status === 429 ? 429 : 502 });
  }
  return data;
}

function normalizeSignup(body) {
  const requiredText = (value, field, maxLength) => {
    if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
      throw Object.assign(new Error(`Signup field '${field}' is missing or invalid.`), { status: 400 });
    }
    return value.trim();
  };

  const signup = {
    userId: requiredText(body.userId, "userId", 60),
    name: requiredText(body.name, "name", 200),
    email: requiredText(body.email, "email", 320),
    mobile: requiredText(body.mobile, "mobile", 20),
    password: requiredText(body.password, "password", 256),
    markets: requiredText(body.markets, "markets", 500),
    signupDate: requiredText(body.signupDate, "signupDate", 30),
    plan: "Free"
  };

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signup.email) || !/^\d{10}$/.test(signup.mobile)) {
    throw Object.assign(new Error("Enter a valid email address and 10-digit mobile number."), { status: 400 });
  }
  return signup;
}

async function saveSignupToGoogleSheets(signup) {
  let webhookUrl;
  try {
    webhookUrl = new URL(googleSheetsWebhookUrl);
  } catch {
    throw Object.assign(new Error("Google Sheets signup sync is not configured on the server."), { status: 503 });
  }
  if (webhookUrl.protocol !== "https:" || webhookUrl.hostname !== "script.google.com" || !/^\/macros\/s\/[^/]+\/exec\/?$/.test(webhookUrl.pathname)) {
    throw Object.assign(new Error("Google Sheets webhook URL is invalid."), { status: 503 });
  }

  let response;
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signup),
      signal: AbortSignal.timeout(20_000)
    });
  } catch {
    throw Object.assign(new Error("Could not reach Google Sheets. Please try again."), { status: 502 });
  }

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.status !== "success") {
    throw Object.assign(new Error("Google Sheets did not confirm the signup. Check the Apps Script deployment and try again."), { status: 502 });
  }
}

async function handleApi(request, response, pathname) {
  if (!allowRequest(request, response)) return;
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "Use POST for AI requests." });
    return;
  }

  try {
    const body = await readJson(request);
    if (pathname === "/api/signup") {
      const signup = normalizeSignup(body);
      await saveSignupToGoogleSheets(signup);
      sendJson(response, 201, { status: "success" });
      return;
    }

    if (pathname === "/api/chat") {
      const messages = normalizeMessages(body.messages);
      const forceWebSearch = requiresFreshWebSearch(messages);
      const data = await callOpenAI({
        model: chatModel,
        reasoning: { effort: forceWebSearch ? "low" : "none" },
        input: messages,
        tools: [{ type: "web_search", search_context_size: forceWebSearch ? "medium" : "low", external_web_access: true }],
        tool_choice: forceWebSearch ? "required" : "auto",
        max_output_tokens: 250,
        store: false
      });
      sendJson(response, 200, { text: extractOutput(data) });
      return;
    }

    sendJson(response, 404, { error: "AI endpoint not found." });
  } catch (error) {
    sendJson(response, error.status || 500, { error: error.message || "The AI request failed." });
  }
}

export { handleApi };

async function handleRequest(request, response) {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  if (pathname === "/api/chat" || pathname === "/api/signup") {
    await handleApi(request, response, pathname);
    return;
  }

  const filename = publicFiles.get(pathname);
  if (!filename || request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  try {
    const file = await readFile(join(root, filename));
    const contentType = filename.endsWith(".svg") ? "image/svg+xml; charset=utf-8" : "text/html; charset=utf-8";
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin"
    });
    response.end(request.method === "HEAD" ? undefined : file);
  } catch {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Could not load the website file.");
  }
}

if (!isVercel) {
  createServer((request, response) => {
    handleRequest(request, response).catch(() => {
      if (!response.headersSent) sendJson(response, 500, { error: "The server could not complete this request." });
      else response.destroy();
    });
  }).listen(port, host, () => {
    console.log(`Pantomic AI is running at http://${host}:${port}`);
  });
}
