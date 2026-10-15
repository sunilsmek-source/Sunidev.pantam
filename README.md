# Pantomic AI — Financial AI Chatbot Web Application

Ek powerful, dark-themed Pantomic AI market assistant, specially built for Indian Markets (NSE, BSE, MCX), Crypto aur Forex.

---

## 🚀 Key Features

1. **Brand Identity**:
   - Brand Name: **Pantomic AI**
   - Custom Vector Logo mark: Glowing Shield & Monogram (**pantomic_logo.svg**).
   - Website ke user interface me Pantomic branding use hoti hai.

2. **Text-Only Chat**:
   - The chatbot uses GPT-6 Luna for every reply.
   - Image generation, image upload, and image analysis are not available; chart and price-action requests receive text explanations.

3. **User Registration & Signup Flow**:
   - Fields: **Full Name**, **10-Digit Mobile Number**, **Email ID**, **Password**, **Markets (NSE/BSE, MCX, Crypto, Forex)**.
   - Signup karte hi user data Google Sheets me live sync hota hai.
   - Signup data Google Sheets me server-side sync hota hai. Current version password ko plain text me save karta hai; public launch se pehle ise secure authentication se replace karna chahiye.
   - Signup ke baad user automatically login hokar AI Chat Dashboard par chala jata hai.

4. **Google Sheets Webhook Integration**:
   - Webhook URL server-side `GOOGLE_SHEETS_WEBHOOK_URL` se configure hota hai (local development me fallback URL hai).
   - Sheet Columns:
     `Col A: User ID | Col B: Full Name | Col C: Email ID | Col D: Mobile Number | Col E: Password | Col F: Market Selected | Col G: Signup Date | Col H: Plan`

5. **GPT-6 Luna & OpenAI Connection**:
   - GPT-6 Luna handles every chat reply through the Responses API.
   - Web search is available for current news, market updates, and prices, with linked citations.
   - The OpenAI API key stays in the server's `OPENAI_API_KEY` environment variable; it is not stored in the HTML files or browser storage.

6. **Voice Speech Output (Audio Talk)**:
   - AI ke answer ke neeche **🔊 Suno (Listen)** button diya gaya hai jisse AI awaz me bolkar answer sunata hai.
   - Microphone input button bhi available hai.

7. **Chatbot Answer & Scroll Fix**:
   - Flex-column layout fix kiya gaya hai.
   - Answer aate hi chat smoothly scroll hoti hai aur bottom input dock ke peeche answer nahi chhupta.

---

## Run locally

Double-click `start-local.bat` to start locally, or install Node.js 20 or later and run:

```powershell
npm start
```

Then open `http://127.0.0.1:3000`. No `npm install` is needed. The local server reads `OPENAI_API_KEY` and `GOOGLE_SHEETS_WEBHOOK_URL` from the ignored `.env` file or process environment. Keep `.env` private and never commit it. On another host, configure both through the host's private environment settings. The settings panel does not accept or save keys in the browser.

## Deploy to Vercel

The root `index.html` is served as a static page. `api/chat.js` and `api/signup.js` are Vercel Node.js Functions; do not run `node server.js` as a Vercel build command. The chat function is limited to 60 seconds on the Hobby plan.

Before deploying:

1. Create a **private** GitHub repository and push this project. `.env` and `.vercel` are ignored by Git.
2. In Vercel, import the repository and select the **Other** framework preset.
3. Under **Project → Settings → Environment Variables**, add these for Production (and Preview if needed):
   - `OPENAI_API_KEY` — a newly created OpenAI API key.
   - `GOOGLE_SHEETS_WEBHOOK_URL` — the Google Apps Script web-app URL ending in `/exec`.
4. Deploy. If you add or change variables later, redeploy so the new deployment receives them.

Chat has no daily query quota and does not need Redis or a database. Signup records are sent to Google Sheets. The current demo stores passwords in plain text in the Sheet and browser storage; use proper authentication before inviting public users.

---

## 📂 File Structure

- `server.js`: Serves the website and securely proxies OpenAI Responses API calls.
- `api/chat.js`, `api/signup.js`: Vercel API function adapters.
- `vercel.json`: Vercel function duration and framework configuration.
- `package.json`: Starts the app with `npm start`.
- `index.html`: Web server entry page.
- `AI with homepage.html`: Alternate homepage copy.
- `pantomic_logo.svg`: Vector logo.
- `GoogleSheets_Integration_Code.gs`: Google Apps Script integration.
