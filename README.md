# NaijaAlias — Nigerian Email Alias Generator & Quota Manager 🇳🇬

A full-stack web application and CLI tool to batch-create authentic Nigerian identities paired with real, deliverable email forwarding aliases via **SimpleLogin** (or **addy.io**).

Built with **Next.js 14**, **React 18**, and **Vanilla CSS** (dark glassmorphic design).

---

## 🌐 Web Dashboard (Next.js)

The web dashboard gives you complete control over your aliases directly in the browser:

- **Generate Aliases**: Create 1, 3, 5, 10 or auto-fill your remaining quota spots.
- **Cultural Heritage Filters**: Select **Yoruba**, **Igbo**, **Edo (Benin)**, or **Balanced All-Nigerian**.
- **Real-Time Active Aliases Board**: View all active aliases, forwarding addresses, delivery stats, with 1-click email copy.
- **Quota Reset & Deletion**: Delete aliases individually or use **Flush All & Reset Quota** to clear all 10 spots for your next rotation.
- **Zero-Duplicate Shield**: Historical names and aliases are tracked in `history.json` so you never get repeat combinations across cycles.
- **Offline Name Preview**: Preview simulated names and alias prefixes before spending quota.
- **CSV Export**: 1-click download of your complete historical ledger as CSV.

### Running Locally

```bash
# 1. Install dependencies (if not already installed)
npm install

# 2. Run the development server
npm run dev

# 3. Open in your browser
http://localhost:3000
```

---

## 🚀 Deploying to Vercel (1-Click)

The application is 100% serverless-ready for Vercel with zero database setup required:

### Option A: Via GitHub (Recommended)
1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "feat: complete Next.js NaijaAlias web dashboard"
   git push origin main
   ```
2. Go to [vercel.com/new](https://vercel.com/new) and import your repository.
3. In **Environment Variables**, add:
   - **Key**: `SIMPLELOGIN_API_KEY`
   - **Value**: `your_simplelogin_api_token_here`
4. Click **Deploy**. Your app will be live at `https://your-project.vercel.app`!

### Option B: Via Vercel CLI
```bash
npx vercel
```
Follow the interactive prompts and enter your `SIMPLELOGIN_API_KEY` when requested.

---

## 🔄 Daily 10-Alias Rotation Cycle (SimpleLogin Free Tier)

SimpleLogin's Free Plan limits you to **10 active aliases at any one time**. You can easily create 10 daily, delete them when finished, and generate a new set of 10 without ever repeating names.

### How the Duplicate Prevention Shield Works:
1. Every alias generated is recorded in a permanent ledger: `history.json`.
2. When you delete the 10 aliases from SimpleLogin, your quota resets to 0/10, but the names remain permanently stored in history.
3. When you generate tomorrow's batch, the generator automatically skips every name combination used in previous cycles!

---

## 💻 CLI Usage (Terminal Alternative)

If you prefer using the terminal, all commands remain available via `alias_gen.py`:

```bash
# Check status and quota
python alias_gen.py config

# Generate 10 aliases and export to CSV
python alias_gen.py generate --count 10 --label "day-1" --export day1.csv

# View active aliases
python alias_gen.py list

# Flush all active aliases to reset quota back to 10 free slots
python alias_gen.py delete --all --yes

# View full historical uniqueness ledger
python alias_gen.py history
```

---

## 📚 Name Banks Included

- `common_nigerian_first_names.txt` (205 names)
- `common_nigerian_surnames.txt` (999 surnames)
- `yoruba_firstnames.txt` (151 names)
- `igbo_firstnames.txt` (41 names)
- `igbo_surnames.txt` (53 surnames)
- `edo_names.txt` (65 names)

**Combined Default Pool**: Over **469+ distinct first names** × **1,028+ distinct surnames** = **482,000+ unique name combinations**!
