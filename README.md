# NaijaAlias — Nigerian Identity Email Alias & Inbox Manager 🇳🇬

A full-stack web application and CLI suite to batch-create authentic Nigerian identities paired with real, deliverable email aliases across multiple engines:
1. **Direct In-App Inbox**: Read full email bodies (formatted HTML & text) directly on the webpage with **zero custom domain required**.
2. **SimpleLogin Relay**: Relay messages anonymously to ProtonMail (`loneewolf15@protonmail.com`) with 1-click search jump and reverse-alias private reply.
3. **addy.io (AnonAddy) Booster**: Relay messages to Gmail (`anonymoux7x@gmail.com`), boosting your limit to 20+ active aliases per day.

Built with **Next.js 14**, **React 18**, and Apple / Konsta UI glassmorphic design (**Vanilla CSS**).

---

## 🌐 Features

- **Multi-Engine Switching**: Seamlessly toggle between **In-App Direct Inbox**, **SimpleLogin**, and **addy.io**, or view a consolidated dashboard.
- **Direct Email Body Reader**: For In-App aliases, read full incoming message content (Subject, From, Date, and complete rich formatted HTML / Plain Text) in an Apple-style modal sheet.
- **Authentic Nigerian Heritage Banks**:
  - 👑 **Yoruba Heritage**
  - 🦅 **Igbo Heritage**
  - ⚔️ **Edo (Benin) Heritage**
  - 🇳🇬 **Balanced All-Nigerian Pool** (482,000+ unique name combinations)
- **Zero-Duplicate Ledger (`history.json`)**: Every identity generated across deletion and rotation cycles is permanently logged so it is never recreated in future batches.
- **Offline Name Preview**: Preview upcoming simulated Nigerian names and alias slugs offline before committing.
- **CSV Ledger Export**: 1-click download of your complete historical ledger for record-keeping.

---

## 🚀 Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/Loneewolf15/email-alias.git
cd email-alias
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your API keys (optional if only using Direct In-App Inbox):
```ini
# addy.io API Key
ANONADDR_API_KEY=your_addy_io_key

# SimpleLogin API Key
SIMPLELOGIN_API_KEY=your_simplelogin_key
```

### 3. Run Locally
```bash
# Start development server
npm run dev

# Or compile and run production server
npm run build
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔒 Privacy & Architecture
- **In-App Inboxes**: Requires zero custom domain setup. Generates instant temporary inboxes with live inbound checking.
- **SimpleLogin & addy.io**: Function as zero-retention privacy relays forwarding encrypted payloads directly to your primary mailboxes.
- **Secrets Protection**: `.env` is ignored by `.gitignore` to prevent any credential leaks.
