# 🌶️ SpicyChat Stats

A tool that collects all your SpicyChat conversation data and displays it in a beautiful, interactive dashboard — right in your browser.

![Dashboard Preview](https://img.shields.io/badge/Built_With-JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)

## ✨ What Does This Do?

1. **Collects your data** — The script fetches all your characters, conversations, and message counts from SpicyChat
2. **Saves it locally** — Everything is stored in a single `aggregated.json` file on your computer
3. **Shows you cool stats** — A dashboard with charts, tables, and a conversations browser

### Dashboard Features

| Tab | What's Inside |
|---|---|
| 📊 **Overview** | Total stats, top characters, tag distribution, message histograms |
| 📅 **Timeline** | Monthly/yearly activity, busiest days, hour-of-day patterns |
| 💬 **Conversations** | Browse all characters, expand to see every conversation, open them directly on SpicyChat |

---

## 📋 What You Need

Before starting, make sure you have **Node.js** installed on your computer.

### Installing Node.js

1. Go to [https://nodejs.org](https://nodejs.org)
2. Download the **LTS** version (the big green button)
3. Run the installer — just click "Next" through everything
4. To verify it worked, open a terminal and type:
   ```
   node --version
   ```
   If you see a version number like `v18.x.x` or higher, you're good!

> **💡 What is a terminal?**
> - **Windows**: Press `Win + R`, type `cmd`, and hit Enter. Or search for "Command Prompt" or "PowerShell" in the Start menu.
> - **Mac**: Press `Cmd + Space`, type "Terminal", and hit Enter.
> - **Linux**: Press `Ctrl + Alt + T`.

---

## 🔑 Step 1: Get Your Bearer Token

The script needs your SpicyChat login token to access your data. Here's how to get it:

1. Open **Google Chrome** (or any browser)
2. Go to [https://spicychat.ai](https://spicychat.ai) and **log in** to your account
3. Open **Developer Tools**:
   - Press `F12` on your keyboard, **or**
   - Press `Ctrl + Shift + I` (Windows/Linux) / `Cmd + Option + I` (Mac)
4. Click the **"Network"** tab at the top of the Developer Tools panel
5. In the filter box, type `v2` to narrow down the requests
6. Now click on anything on the SpicyChat website (like opening a chat)
7. You'll see network requests appear in the list — **click on any one of them**
8. In the right panel, scroll down to **"Request Headers"**
9. Find the line that says **`Authorization: Bearer eyJ...`**
10. **Copy everything after `Bearer `** — that long string starting with `eyJ` is your token

> ⚠️ **Important:** This token is like a password — **never share it** with anyone! It gives full access to your SpicyChat account.

> ⚠️ **Token Expiry:** Tokens expire after some time. If the script gives you authentication errors, just repeat these steps to get a fresh token.

---

## 📥 Step 2: Download & Set Up

1. **Download this project** — Click the green "Code" button on GitHub, then "Download ZIP", and unzip it somewhere on your computer. Or if you know Git:
   ```bash
   git clone https://github.com/ReneR97/spicychatstats.git
   cd spicychatstats
   ```

2. **Install dependencies** — Open a terminal **in the project folder** and run:
   ```bash
   npm install
   ```
   This downloads the one library the script needs (`axios` for making web requests).

3. **Paste your token** — Open the file `index.js` in any text editor (Notepad, VS Code, etc.) and find this line near the top:
   ```js
   const BEARER_TOKEN = 'eyJ...';
   ```
   Replace the token inside the quotes with **your own token** from Step 1.

---

## ▶️ Step 3: Run the Script

In your terminal (make sure you're in the project folder), run:

```bash
node index.js
```

**First run** — When there's no `aggregated.json` yet, the script does a full crawl of all your characters:

```
=== SpicyChat Data Aggregator ===

[Step 1] Fetching all conversations...
  Fetching conversations page 1...
  ...
[Info] Found 150 unique characters from the API.

  (1/150) Processing "CharacterA"...
  (2/150) Processing "CharacterB"...
  ...
=== Done! Data saved to aggregated.json ===
```

**Subsequent runs** — When `aggregated.json` already exists, the script is smart about it: it checks each character for new conversations **or new messages**, and only recrawls what has changed:

```
=== SpicyChat Data Aggregator ===

[Info] Found 150 unique characters from the API.
  Loaded 150 existing characters from aggregated.json

  (1/150) ⏭  Skipping "CharacterA" (3 convos, unchanged)
  (2/150) 🔄 Updating "CharacterB" (2 → 3 convos)
  (3/150) 🔄 Updating "CharacterC" (45 → 52 messages)
  ...

── Incremental summary ──
  ✨ New:       0
  🔄 Updated:   2
  ⏭  Skipped:   148
```

> **⏳ How long does it take?**
> - **First run:** Depends on how many characters you have. For ~150 characters, expect about **1-2 minutes**.
> - **Later runs:** Characters without changes are skipped, so updates are faster.

> **💡 Want a completely fresh dataset?** Just delete `aggregated.json` and run the script again.

---

## 📊 Step 4: View Your Dashboard

Now for the fun part! You need a simple web server to view the dashboard. Run this in your terminal:

```bash
npx -y http-server . -p 8080 -c-1
```

> **What does this do?** It starts a tiny web server on your computer. The `-c-1` part disables caching so you always see the latest data.

Then open your browser and go to:

```
http://localhost:8080/stats.html
```

🎉 **That's it!** Your dashboard should load with all your stats.

> **To stop the server**, go back to your terminal and press `Ctrl + C`.

---

## 🗂️ Project Files

| File | Purpose |
|---|---|
| `index.js` | The data collection script — fetches your data from SpicyChat |
| `stats.html` | The dashboard — displays all your stats in the browser |
| `aggregated.json` | Your data — created after running the script |
| `package.json` | Project configuration & dependencies |

---

## ❓ Troubleshooting

### "Error: Request failed with status code 401"
Your token has expired. Get a new one (see [Step 1](#-step-1-get-your-bearer-token)) and paste it into `index.js`.

### "node: command not found"
Node.js isn't installed or isn't in your system PATH. Reinstall it from [nodejs.org](https://nodejs.org) and make sure to check the "Add to PATH" option during installation.

### "Cannot find module 'axios'"
You forgot to install dependencies. Run `npm install` in the project folder.

### The dashboard shows "Loading..." forever
Make sure `aggregated.json` exists in the same folder. Run `node index.js` first to generate it.

### Charts look weird or empty
Some data might be missing (e.g., no `createdAt` dates for old conversations). This is normal — the charts will show whatever data is available.

---

## 📄 License

This project is for personal use. Your data stays on your computer — nothing is sent anywhere except to SpicyChat's own API to fetch your existing data.
