#!/usr/bin/env python3
"""
Email Alias Generator — with Nigerian Name Support, Rate-Limit Resiliency & Batch Cycle Management
==================================================================================================
Generates real, deliverable email aliases via SimpleLogin or AnonAddy (addy.io).
Aliases are paired with Nigerian names (Yoruba, Igbo, Hausa, Edo) or your own imported names.
Email alias prefixes are intelligently constructed from the generated names.

Rate Limit Resiliency:
- Automatic detection of HTTP 429 (Rate Limit Exceeded).
- Progressive exponential backoff pause and automatic retry so batches complete reliably.
- Smart quota detection for SimpleLogin Free Plan (10 active aliases limit).

Historical Tracking:
- Every alias generated is recorded in a permanent ledger (history.json).
- Even after you delete an alias from SimpleLogin, its name and prefix are never re-used!
- Perfect for rotating batches (e.g. 10 per day on SimpleLogin Free Plan).

Usage:
    # 1. Generate 10 aliases for today (with rate-limit backoff safety)
    python alias_gen.py generate --count 10 --label "day-1" --export day1.csv

    # 2. Complete remaining free spots to reach 10/10:
    python alias_gen.py generate --fill --label "day-1" --export day1.csv

    # 3. Check active aliases
    python alias_gen.py list

    # 4. Delete all active aliases to reset quota (names stay recorded in history)
    python alias_gen.py delete --all --yes

    # 5. Generate tomorrow's 10 fresh, non-repeating aliases
    python alias_gen.py generate --count 10 --label "day-2" --export day2.csv

    # Inspect config & history
    python alias_gen.py config
    python alias_gen.py history
"""

import argparse
import csv
import json
import os
import random
import re
import string
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

try:
    import requests
except ImportError:
    print("[ERROR] 'requests' is not installed. Run: pip install requests python-dotenv")
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    print("[ERROR] 'python-dotenv' is not installed. Run: pip install requests python-dotenv")
    sys.exit(1)

# ── Paths & Endpoints ─────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
ENV_FILE = SCRIPT_DIR / ".env"
REGISTRY_FILE = SCRIPT_DIR / "aliases.json"
HISTORY_FILE = SCRIPT_DIR / "history.json"

ANONADDR_BASE_URL = "https://app.addy.io/api/v1"
SIMPLELOGIN_BASE_URL = "https://app.simplelogin.io/api"

# ── Built-in Seed Nigerian Names ──────────────────────────────────────────────
NIGERIAN_FIRST_NAMES = [
    # Yoruba
    "Adewale", "Adeola", "Adebayo", "Adunola", "Afolabi", "Ayodele", "Ayodeji",
    "Bolanle", "Busayo", "Damilola", "Eniola", "Folake", "Funmilayo", "Gbemisola",
    "Ifeoluwa", "Jumoke", "Kehinde", "Kola", "Laide", "Mojisola", "Modupe",
    "Nike", "Olabisi", "Olajumoke", "Oluwaseun", "Oluwafemi", "Olumide",
    "Omolola", "Ronke", "Segun", "Seun", "Taiwo", "Temitope", "Titi",
    "Tolulope", "Tunde", "Yetunde", "Yewande", "Wale",
    # Igbo
    "Adaeze", "Amaka", "Chidi", "Chidinma", "Chika", "Chikamso", "Chinedu",
    "Chinwe", "Chioma", "Emeka", "Ebele", "Ifunanya", "Ikenna", "Kelechi",
    "Ngozi", "Nnamdi", "Obiageli", "Obinna", "Ogechukwu", "Onyeka",
    "Somtochukwu", "Tobechukwu", "Ugochi", "Uche", "Uchenna", "Uzochi",
    # Hausa / Fulani
    "Abdullahi", "Abubakar", "Adama", "Aisha", "Aliyu", "Aminu", "Bilkisu",
    "Fatima", "Habiba", "Hafsat", "Halima", "Ibrahim", "Jamila", "Khadija",
    "Laila", "Maryam", "Mohammed", "Muhammadu", "Mustapha", "Nafisa", "Ramatu",
    "Sadiya", "Salisu", "Sule", "Usman", "Yakubu", "Zainab",
    # Edo & Niger Delta
    "Osaze", "Osas", "Efe", "Oghenekevwe", "Tare", "Ebi", "Ovie", "Itohan",
]

NIGERIAN_LAST_NAMES = [
    # Yoruba
    "Adebayo", "Adeyemi", "Afolabi", "Akinwale", "Akinola", "Akintola", "Alabi",
    "Babatunde", "Badmus", "Bakare", "Balogun", "Bankole", "Dada", "Falola",
    "Fashola", "Fawole", "Gbadamosi", "Jinadu", "Ladipo", "Lawal", "Martins",
    "Odunbaku", "Ogundele", "Ogundimu", "Ogunlana", "Olawale", "Olayinka",
    "Olusegun", "Omotosho", "Oyewole", "Salami", "Sowande",
    # Igbo
    "Achebe", "Agwu", "Ani", "Anya", "Chukwu", "Dike", "Eze", "Ezeh", "Igwe",
    "Ihejirika", "Ikenna", "Madu", "Nwosu", "Nnamani", "Obasi", "Obiora",
    "Odogwu", "Okafor", "Okeke", "Okonkwo", "Okoro", "Onyema", "Umeh", "Uzor",
    # Hausa / Fulani
    "Abubakar", "Aliyu", "Aminu", "Bello", "Dantata", "Garba", "Goni", "Haruna",
    "Inuwa", "Jibril", "Lawan", "Musa", "Rabiu", "Sani", "Shehu", "Tanko",
    "Tukur", "Wada", "Yaro", "Yusuf", "Zanna",
    # Edo & Niger Delta
    "Igbinedion", "Imasuen", "Omoigui", "Okowa", "Asuni", "Briggs", "Amadi",
]


# ── Name Mixing & Loading Helpers ─────────────────────────────────────────────

def sanitize_slug(text: str) -> str:
    """Convert a name into a clean, lowercased alphanumeric string suitable for an email prefix."""
    text = re.sub(r"[^a-zA-Z0-9]", "", text)
    return text.lower()


def load_single_name_list(path: str) -> List[str]:
    """Load a single-name list from a txt or csv file (supports path with or without .txt extension)."""
    p = Path(path)
    if not p.is_absolute():
        if (SCRIPT_DIR / p).exists():
            p = SCRIPT_DIR / p
        elif (SCRIPT_DIR / f"{p}.txt").exists():
            p = SCRIPT_DIR / f"{p}.txt"
        elif Path(f"{path}.txt").exists():
            p = Path(f"{path}.txt")

    if not p.exists():
        print(f"[ERROR] Name list file not found: {path}")
        sys.exit(1)

    names: List[str] = []
    seen: Set[str] = set()

    with open(p, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = [pt.strip() for pt in line.split(",") if pt.strip()]
            for pt in parts:
                cleaned = " ".join(part.capitalize() for part in pt.split())
                if cleaned and cleaned not in seen:
                    seen.add(cleaned)
                    names.append(cleaned)

    return names


def get_available_pools() -> Tuple[List[str], List[str]]:
    """
    Auto-discovers and merges all saved local name files:
    - First names: common_nigerian_first_names, yoruba_firstnames, igbo_firstnames, edo_names
    - Surnames: common_nigerian_surnames, igbo_surnames
    Merged with built-in seed banks.
    """
    first_pool = set(NIGERIAN_FIRST_NAMES)
    last_pool = set(NIGERIAN_LAST_NAMES)

    first_files = ["common_nigerian_first_names", "yoruba_firstnames", "igbo_firstnames", "edo_names"]
    for fn in first_files:
        for candidate in [SCRIPT_DIR / f"{fn}.txt", SCRIPT_DIR / fn]:
            if candidate.exists():
                first_pool.update(load_single_name_list(str(candidate)))
                break

    last_files = ["common_nigerian_surnames", "igbo_surnames"]
    for fn in last_files:
        for candidate in [SCRIPT_DIR / f"{fn}.txt", SCRIPT_DIR / fn]:
            if candidate.exists():
                last_pool.update(load_single_name_list(str(candidate)))
                break

    return sorted(first_pool), sorted(last_pool)


def load_history() -> List[dict]:
    """Load the permanent history ledger of all aliases ever created (active and deleted)."""
    if not HISTORY_FILE.exists():
        return []
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def append_history(new_entries: List[dict]) -> None:
    """Record newly created aliases into the permanent history file."""
    if not new_entries:
        return
    history = load_history()
    history.extend(new_entries)
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)


def get_used_names_set() -> Set[str]:
    """Return lowercase strings of all full names and aliases that have EVER been created."""
    history = load_history()
    registry = load_registry()
    combined = history + registry

    used = set()
    for e in combined:
        fn = e.get("full_name", "").strip().lower()
        if fn:
            used.add(fn)
        alias = e.get("alias", "").lower()
        if alias:
            used.add(alias)
    return used


def generate_nigerian_name(first_pool: List[str], last_pool: List[str], used_pairs: Set[Tuple[str, str]], used_history: Set[str]) -> Tuple[str, str]:
    """Generate a random first and last name pair, strictly avoiding names previously created in history."""
    for _ in range(500):
        first = random.choice(first_pool)
        last = random.choice(last_pool)
        pair = (first, last)
        full_lower = f"{first} {last}".lower()
        if pair not in used_pairs and full_lower not in used_history:
            used_pairs.add(pair)
            return pair

    suffix = random.randint(10, 99)
    first = random.choice(first_pool)
    last = random.choice(last_pool)
    return first, f"{last}{suffix}"


def load_names_from_file(path: str, mix: bool = True, used_history: Optional[Set[str]] = None) -> List[Tuple[str, str]]:
    """Load mixed name pairs from a file (CSV or plain TXT), filtering out historically used names."""
    p = Path(path)
    if not p.is_absolute():
        if (SCRIPT_DIR / p).exists():
            p = SCRIPT_DIR / p
        elif (SCRIPT_DIR / f"{p}.txt").exists():
            p = SCRIPT_DIR / f"{p}.txt"

    if not p.exists():
        print(f"[ERROR] Names file not found: {path}")
        sys.exit(1)

    first_names: List[str] = []
    last_names: List[str] = []

    if p.suffix.lower() == ".csv":
        with open(p, newline="", encoding="utf-8") as f:
            sample = f.read(2048)
            f.seek(0)
            delimiter = ","
            try:
                dialect = csv.Sniffer().sniff(sample)
                delimiter = dialect.delimiter
            except Exception:
                pass

            reader = csv.DictReader(f, delimiter=delimiter)
            headers = [h.strip().lower() for h in (reader.fieldnames or [])]
            reader.fieldnames = headers

            fn_key = next((k for k in headers if "first" in k or "fname" in k), None)
            ln_key = next((k for k in headers if "last" in k or "lname" in k or "sur" in k), None)

            for row in reader:
                if fn_key and ln_key and row.get(fn_key) and row.get(ln_key):
                    first_names.append(row[fn_key].strip().capitalize())
                    last_names.append(row[ln_key].strip().capitalize())
                else:
                    values = [v.strip() for v in row.values() if v and v.strip()]
                    if values:
                        full = values[0]
                        parts = full.split()
                        if len(parts) >= 2:
                            first_names.append(parts[0].capitalize())
                            last_names.append(" ".join(parts[1:]).capitalize())
                        elif parts:
                            first_names.append(parts[0].capitalize())
                            last_names.append(parts[0].capitalize())
    else:
        with open(p, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split()
                if len(parts) >= 2:
                    first_names.append(parts[0].capitalize())
                    last_names.append(" ".join(parts[1:]).capitalize())
                elif parts:
                    first_names.append(parts[0].capitalize())
                    last_names.append(parts[0].capitalize())

    if not first_names:
        print(f"[ERROR] No valid names found in {path}")
        sys.exit(1)

    print(f"  📂 Loaded {len(first_names)} first names and {len(last_names)} last names from {p.name}")

    if mix:
        random.shuffle(first_names)
        random.shuffle(last_names)
        total_combos = max(len(first_names), len(last_names))
        pairs = []
        for i in range(total_combos):
            fn = first_names[i % len(first_names)]
            ln = last_names[i % len(last_names)]
            if used_history and f"{fn} {ln}".lower() in used_history:
                continue
            pairs.append((fn, ln))
        random.shuffle(pairs)
        print(f"  🔀 Mixed up into {len(pairs)} unused combinations\n")
        return pairs
    else:
        pairs = [(fn, ln) for fn, ln in zip(first_names, last_names) if not (used_history and f"{fn} {ln}".lower() in used_history)]
        print(f"  📋 Kept original pairings ({len(pairs)} unused names)\n")
        return pairs


# ── Environment & Storage ─────────────────────────────────────────────────────

def load_env() -> dict:
    """Load configuration from .env file."""
    load_dotenv(ENV_FILE)
    return {
        "provider": os.getenv("ALIAS_PROVIDER", "simplelogin").lower(),
        "anonaddr_key": os.getenv("ANONADDR_API_KEY", ""),
        "anonaddr_domain": os.getenv("ANONADDR_DOMAIN", "anonaddy.me"),
        "simplelogin_key": os.getenv("SIMPLELOGIN_API_KEY", ""),
    }


def load_registry() -> List[dict]:
    """Load currently active aliases from JSON file."""
    if not REGISTRY_FILE.exists():
        return []
    try:
        with open(REGISTRY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def save_registry(entries: List[dict]) -> None:
    """Save active aliases to JSON file."""
    with open(REGISTRY_FILE, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2)
    print(f"  📁 Active registry updated → {REGISTRY_FILE}")


def print_alias_row(entry: dict, index: int) -> None:
    """Format and print an alias entry."""
    print(f"  [{index:>3}] {entry.get('alias', '?')}")
    print(f"        Name    : {entry.get('full_name', '—')}")
    print(f"        Label   : {entry.get('label') or '—'}")
    print(f"        Provider: {entry.get('provider', '?')}  |  ID: {entry.get('id', '—')}")
    print(f"        Created : {entry.get('created_at', '?')}")
    print()


# ── SimpleLogin Integration with Rate Limit Backoff ────────────────────────────

class SimpleLoginClient:
    """Client for SimpleLogin API with custom name-based alias support and 429 backoff retry."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {
            "Authentication": api_key,
            "Content-Type": "application/json",
        }
        self._cached_options: Optional[dict] = None
        self._default_mailbox_id: Optional[int] = None

    def _api_request(self, method: str, path: str, max_retries: int = 3, **kwargs) -> Optional[requests.Response]:
        """Execute a SimpleLogin API request with automatic retry and 62s window reset on HTTP 429."""
        url = f"{SIMPLELOGIN_BASE_URL}{path}"
        headers = {**self.headers, **kwargs.pop("headers", {})}

        for attempt in range(max_retries + 1):
            try:
                resp = requests.request(method, url, headers=headers, timeout=15, **kwargs)
                if resp.status_code == 429:
                    if attempt < max_retries:
                        # SimpleLogin enforces a strict 5 aliases per minute limit.
                        # We must wait 62 seconds for the rolling 1-minute window to completely clear.
                        wait_seconds = 62.0
                        print(f"\n  ⏳ [SimpleLogin 5/minute Rate Limit] Hit API ceiling. Waiting {wait_seconds:.0f}s for the 1-minute window to reset before auto-retrying (attempt {attempt+1}/{max_retries})...")
                        for remaining in range(int(wait_seconds), 0, -10):
                            print(f"      ...resuming in {remaining}s")
                            time.sleep(10)
                        time.sleep(int(wait_seconds) % 10)
                        continue
                    else:
                        print(f"  [SimpleLogin ERROR] HTTP 429: Rate limit exceeded after {max_retries} retries.")
                        return resp
                return resp
            except requests.exceptions.RequestException as e:
                if attempt < max_retries:
                    time.sleep(3.0)
                    continue
                print(f"  [SimpleLogin Network ERROR] {e}")
                return None
        return None

    def get_user_info(self) -> Optional[dict]:
        resp = self._api_request("GET", "/user_info")
        if resp is not None and resp.status_code == 200:
            return resp.json()
        return None

    def get_active_alias_count(self) -> int:
        resp = self._api_request("GET", "/v2/aliases?page_id=0")
        if resp is not None and resp.status_code == 200:
            return len(resp.json().get("aliases", []))
        return 0

    def get_options(self) -> Optional[dict]:
        if self._cached_options:
            return self._cached_options
        resp = self._api_request("GET", "/v5/alias/options")
        if resp is not None and resp.status_code == 200:
            self._cached_options = resp.json()
            return self._cached_options
        return None

    def get_default_mailbox_id(self) -> Optional[int]:
        if self._default_mailbox_id:
            return self._default_mailbox_id
        resp = self._api_request("GET", "/mailboxes")
        if resp is not None and resp.status_code == 200:
            mailboxes = resp.json().get("mailboxes", [])
            for m in mailboxes:
                if m.get("default"):
                    self._default_mailbox_id = m.get("id")
                    return self._default_mailbox_id
            if mailboxes:
                self._default_mailbox_id = mailboxes[0].get("id")
                return self._default_mailbox_id
        return None

    def create_name_alias(self, first_name: str, last_name: str, full_name: str, note: str) -> Optional[dict]:
        """
        Attempts to create a custom name-based alias (e.g. adewale.adebayo.xxxx@slmails.com).
        Falls back to random alias if custom prefix is taken or fails.
        """
        options = self.get_options()
        mailbox_id = self.get_default_mailbox_id()

        clean_first = sanitize_slug(first_name)
        clean_last = sanitize_slug(last_name)

        if options and options.get("can_create") and options.get("suffixes") and mailbox_id:
            suffixes = options.get("suffixes", [])
            suffix_obj = suffixes[0]
            signed_suffix = suffix_obj.get("signed_suffix")

            prefixes_to_try = [
                f"{clean_first}.{clean_last}",
                f"{clean_first}.{clean_last}.{random.randint(10, 99)}",
            ]

            for prefix in prefixes_to_try:
                payload = {
                    "alias_prefix": prefix,
                    "signed_suffix": signed_suffix,
                    "mailbox_ids": [mailbox_id],
                    "note": note,
                    "name": full_name,
                }
                resp = self._api_request("POST", "/v3/alias/custom/new", json=payload)
                if resp is not None:
                    if resp.status_code in (200, 201):
                        data = resp.json()
                        return {
                            "id": str(data.get("id")),
                            "alias": data.get("email"),
                            "provider": "simplelogin",
                        }
                    elif resp.status_code == 409:
                        # Taken prefix: continue to disambiguated variation
                        continue
                    elif resp.status_code == 429:
                        # Rate limit retry exhausted
                        break

        return self.create_random_alias(note=note, full_name=full_name)

    def create_random_alias(self, note: str, full_name: Optional[str] = None) -> Optional[dict]:
        """Create a random alias via SimpleLogin API with rate limit backoff."""
        payload = {"note": note}
        resp = self._api_request("POST", "/alias/random/new", json=payload)
        if resp is None or resp.status_code not in (200, 201):
            if resp is not None:
                print(f"  [SimpleLogin ERROR] HTTP {resp.status_code}: {resp.text}")
            return None

        data = resp.json()
        alias_id = str(data.get("id"))
        alias_email = data.get("email")

        if full_name:
            self._api_request("PATCH", f"/aliases/{alias_id}", json={"name": full_name}, max_retries=2, backoff=3.0)

        return {
            "id": alias_id,
            "alias": alias_email,
            "provider": "simplelogin",
        }

    def delete_alias(self, alias_id: str) -> bool:
        """Delete alias by ID with retry handling."""
        resp = self._api_request("DELETE", f"/aliases/{alias_id}")
        if resp is not None and resp.status_code in (200, 204):
            try:
                return resp.json().get("deleted", True)
            except Exception:
                return True
        return False


# ── AnonAddy (addy.io) Integration ───────────────────────────────────────────

class AnonAddyClient:
    """Client for AnonAddy API with custom or random alias support and retry handling."""

    def __init__(self, api_key: str, domain: str):
        self.api_key = api_key
        self.domain = domain
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
        }

    def _api_request(self, method: str, path: str, max_retries: int = 4, backoff: float = 5.0, **kwargs) -> Optional[requests.Response]:
        url = f"{ANONADDR_BASE_URL}{path}"
        headers = {**self.headers, **kwargs.pop("headers", {})}

        for attempt in range(max_retries + 1):
            try:
                resp = requests.request(method, url, headers=headers, timeout=15, **kwargs)
                if resp.status_code == 429:
                    if attempt < max_retries:
                        wait = backoff * (attempt + 1)
                        print(f"\n  ⏳ [Rate Limit 429] AnonAddy throttled. Pausing {wait:.1f}s before retry ({attempt+1}/{max_retries})...")
                        time.sleep(wait)
                        continue
                return resp
            except requests.exceptions.RequestException as e:
                if attempt < max_retries:
                    time.sleep(2.0)
                    continue
                return None
        return None

    def create_name_alias(self, first_name: str, last_name: str, full_name: str, description: str) -> Optional[dict]:
        clean_first = sanitize_slug(first_name)
        clean_last = sanitize_slug(last_name)
        local_part = f"{clean_first}.{clean_last}"

        payload = {
            "domain": self.domain,
            "description": description,
            "format": "custom",
            "local_part": local_part,
        }
        resp = self._api_request("POST", "/aliases", json=payload)
        if resp is not None and resp.status_code in (200, 201):
            data = resp.json().get("data", {})
            return {"id": data.get("id"), "alias": data.get("email"), "provider": "anonaddr"}

        return self.create_random_alias(description)

    def create_random_alias(self, description: str) -> Optional[dict]:
        payload = {"domain": self.domain, "description": description, "format": "random_words"}
        resp = self._api_request("POST", "/aliases", json=payload)
        if resp is not None and resp.status_code in (200, 201):
            data = resp.json().get("data", {})
            return {"id": data.get("id"), "alias": data.get("email"), "provider": "anonaddr"}
        return None

    def delete_alias(self, alias_id: str) -> bool:
        resp = self._api_request("DELETE", f"/aliases/{alias_id}")
        return resp is not None and resp.status_code == 204


# ── Commands ──────────────────────────────────────────────────────────────────

def validate_provider(provider: str, env: dict) -> None:
    if provider == "simplelogin":
        if not env["simplelogin_key"]:
            print("[ERROR] SIMPLELOGIN_API_KEY not set in .env")
            sys.exit(1)
    elif provider == "anonaddr":
        if not env["anonaddr_key"]:
            print("[ERROR] ANONADDR_API_KEY not set in .env")
            sys.exit(1)
    else:
        print(f"[ERROR] Unknown provider '{provider}'. Use 'simplelogin' or 'anonaddr'.")
        sys.exit(1)


def build_name_pairs(args, count: int) -> List[Tuple[str, str]]:
    """Determine name pairings based on arguments or auto-discovered local pools, filtering out past history."""
    used_history = get_used_names_set()
    if used_history:
        print(f"  🔒 History Shield: {len(used_history)} names/aliases already used in the past will NOT be repeated.")

    if args.names_file:
        mix_names = not args.no_mix
        pairs = load_names_from_file(args.names_file, mix=mix_names, used_history=used_history)
        while len(pairs) < count:
            pairs.extend(load_names_from_file(args.names_file, mix=mix_names, used_history=used_history))
        return pairs[:count]

    first_pool, last_pool = get_available_pools()

    if getattr(args, "first_names", None):
        first_pool = load_single_name_list(args.first_names)
        print(f"  📁 Using first names from: {args.first_names} ({len(first_pool)} names)")
    if getattr(args, "surnames", None):
        last_pool = load_single_name_list(args.surnames)
        print(f"  📁 Using surnames from: {args.surnames} ({len(last_pool)} names)")

    if not getattr(args, "first_names", None) and not getattr(args, "surnames", None):
        print(f"  🇳🇬 Using auto-discovered Nigerian name pools: {len(first_pool)} first names × {len(last_pool)} surnames ({len(first_pool)*len(last_pool):,} combinations)")

    used_pairs: Set[Tuple[str, str]] = set()
    return [generate_nigerian_name(first_pool, last_pool, used_pairs, used_history) for _ in range(count)]


def cmd_generate(args, env: dict) -> None:
    count = args.count
    label = args.label or f"batch-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    provider = (args.provider or env["provider"]).lower()
    validate_provider(provider, env)

    sl_client = SimpleLoginClient(env["simplelogin_key"]) if provider == "simplelogin" else None
    aa_client = AnonAddyClient(env["anonaddr_key"], env["anonaddr_domain"]) if provider == "anonaddr" else None

    # Quota validation for SimpleLogin free plan
    if provider == "simplelogin" and sl_client:
        user_info = sl_client.get_user_info()
        if user_info and not user_info.get("is_premium"):
            active_count = sl_client.get_active_alias_count()
            max_free = user_info.get("max_alias_free_plan", 10)
            remaining = max(0, max_free - active_count)
            print(f"\n  ℹ️  SimpleLogin Free Plan: {active_count}/{max_free} active aliases currently in use ({remaining} spots available).")

            if getattr(args, "fill", False):
                count = remaining
                print(f"  🎯 Auto-fill mode: generating remaining {count} alias(es) to reach 10/10 capacity.\n")
                if count <= 0:
                    print("  ✅ Quota is already full (10/10)! Delete aliases before generating more.\n")
                    return
            elif count > remaining:
                if remaining == 0:
                    print(f"\n  ⛔ All {max_free} free alias spots are currently in use!")
                    print(f"      Run `python alias_gen.py delete --all` to reset your quota first.\n")
                    return
                print(f"  ⚠️  Requested {count} aliases, but only {remaining} spot(s) available before plan limit.")
                print(f"      Adjusting batch count to {remaining} to prevent plan limit errors.\n")
                count = remaining

    print(f"\n🚀 Generating {count} alias(es) via [{provider}]  |  Label: '{label}'\n")

    name_pairs = build_name_pairs(args, count)
    print(f"  ✨ Generated {len(name_pairs)} distinct, historically unique name pairings\n")

    registry = load_registry()
    new_entries: List[dict] = []

    for i in range(count):
        first, last = name_pairs[i % len(name_pairs)]
        full_name = f"{first} {last}"
        note = f"{label} | {full_name}"

        result = None
        if provider == "simplelogin" and sl_client:
            if getattr(args, "random_prefix", False):
                result = sl_client.create_random_alias(note=note, full_name=full_name)
            else:
                result = sl_client.create_name_alias(first_name=first, last_name=last, full_name=full_name, note=note)
        elif provider == "anonaddr" and aa_client:
            if getattr(args, "random_prefix", False):
                result = aa_client.create_random_alias(description=note)
            else:
                result = aa_client.create_name_alias(first_name=first, last_name=last, full_name=full_name, description=note)

        if result:
            entry = {
                "id": result["id"],
                "alias": result["alias"],
                "provider": result["provider"],
                "full_name": full_name,
                "first_name": first,
                "last_name": last,
                "label": label,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            new_entries.append(entry)
            print(f"  ✅ [{i+1:>3}/{count}]  {full_name:<28}  →  {result['alias']}")
        else:
            print(f"  ❌ [{i+1:>3}/{count}]  {full_name:<28}  →  Creation Failed")

        if i < count - 1:
            if provider == "simplelogin" and (len(new_entries) > 0 and len(new_entries) % 4 == 0):
                print(f"\n  ☕ Pacing batch ({len(new_entries)} aliases created). Pausing 60s to respect SimpleLogin's 5/minute window...")
                for rem in range(60, 0, -10):
                    print(f"      ...resuming in {rem}s")
                    time.sleep(10)
            else:
                time.sleep(args.delay)

    # Save to active registry AND permanent history ledger
    registry.extend(new_entries)
    save_registry(registry)
    append_history(new_entries)

    print(f"\n✨ {len(new_entries)}/{count} aliases successfully generated.")
    print(f"  📜 Logged {len(new_entries)} names to permanent history (will never be recreated).\n")

    if new_entries and args.export:
        export_path = Path(args.export)
        if not export_path.is_absolute():
            export_path = SCRIPT_DIR / export_path
        with open(export_path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["full_name", "first_name", "last_name", "alias", "label", "provider", "id", "created_at"])
            for e in new_entries:
                w.writerow([
                    e["full_name"],
                    e["first_name"],
                    e["last_name"],
                    e["alias"],
                    e["label"],
                    e["provider"],
                    e["id"],
                    e["created_at"],
                ])
        print(f"  📊 Exported {len(new_entries)} records to CSV → {export_path}\n")


def cmd_names(args, env: dict) -> None:
    count = args.count
    print(f"\n🇳🇬 Previewing Nigerian Names ({count})\n")
    pairs = build_name_pairs(args, count)
    for i, (first, last) in enumerate(pairs, 1):
        prefix = f"{sanitize_slug(first)}.{sanitize_slug(last)}"
        print(f"  {i:>3}.  {first} {last:<24} (alias prefix suggestion: {prefix})")
    print()

    if getattr(args, "export", None) and pairs:
        export_path = Path(args.export)
        if not export_path.is_absolute():
            export_path = SCRIPT_DIR / export_path
        with open(export_path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["full_name", "first_name", "last_name", "suggested_alias_prefix"])
            for first, last in pairs:
                prefix = f"{sanitize_slug(first)}.{sanitize_slug(last)}"
                w.writerow([f"{first} {last}", first, last, prefix])
        print(f"  📊 Exported {len(pairs)} records to CSV → {export_path}\n")


def cmd_list(args, env: dict) -> None:
    registry = load_registry()
    if not registry:
        print("\n📭 Registry is empty (0 active aliases). Run: python alias_gen.py generate\n")
        return

    label_filter = getattr(args, "label", None)
    if label_filter:
        registry = [e for e in registry if label_filter.lower() in (e.get("label") or "").lower()]

    print(f"\n📋 Active Alias Registry — {len(registry)} entries\n")
    for i, e in enumerate(registry, 1):
        print_alias_row(e, i)

    if getattr(args, "export", None) and registry:
        export_path = Path(args.export)
        if not export_path.is_absolute():
            export_path = SCRIPT_DIR / export_path
        with open(export_path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["full_name", "first_name", "last_name", "alias", "label", "provider", "id", "created_at"])
            for e in registry:
                w.writerow([
                    e.get("full_name", ""),
                    e.get("first_name", ""),
                    e.get("last_name", ""),
                    e.get("alias", ""),
                    e.get("label", ""),
                    e.get("provider", ""),
                    e.get("id", ""),
                    e.get("created_at", ""),
                ])
        print(f"  📊 Exported registry to CSV → {export_path}\n")


def cmd_history(args, env: dict) -> None:
    history = load_history()
    if not history:
        print("\n📭 No historical aliases recorded yet.\n")
        return

    print(f"\n📜 Permanent Alias History Ledger — {len(history)} total created over time\n")
    for i, e in enumerate(history, 1):
        alias = e.get("alias", "—")
        full_name = e.get("full_name", "—")
        created = e.get("created_at", "—")
        label = e.get("label", "—")
        print(f"  [{i:>3}] {alias:<35} | {full_name:<26} | Label: {label:<12} | {created}")
    print()

    if getattr(args, "export", None):
        export_path = Path(args.export)
        if not export_path.is_absolute():
            export_path = SCRIPT_DIR / export_path
        with open(export_path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["full_name", "first_name", "last_name", "alias", "label", "provider", "id", "created_at"])
            for e in history:
                w.writerow([
                    e.get("full_name", ""),
                    e.get("first_name", ""),
                    e.get("last_name", ""),
                    e.get("alias", ""),
                    e.get("label", ""),
                    e.get("provider", ""),
                    e.get("id", ""),
                    e.get("created_at", ""),
                ])
        print(f"  📊 Exported history ledger to CSV → {export_path}\n")


def cmd_delete(args, env: dict) -> None:
    registry = load_registry()
    if not registry:
        print("\n📭 Active registry is already empty. No active aliases to delete.\n")
        return

    if getattr(args, "all", False) or getattr(args, "label", None):
        label_filter = getattr(args, "label", None)
        targets = [e for e in registry if (not label_filter or label_filter.lower() in (e.get("label") or "").lower())]

        if not targets:
            print(f"\n[INFO] No active aliases matched label filter '{label_filter}'.\n")
            return

        print(f"\n⚠️  About to delete {len(targets)} active alias(es) from provider:")
        for t in targets:
            print(f"    - {t.get('alias')} ({t.get('full_name')}) [ID: {t.get('id')}]")

        if not getattr(args, "yes", False):
            confirm = input(f"\nAre you sure you want to delete these {len(targets)} alias(es)? (y/N): ").strip().lower()
            if confirm not in ("y", "yes"):
                print("Operation cancelled. Active registry untouched.\n")
                return

        print("\n🗑  Proceeding with batch deletion...")
        deleted_ids = set()
        for t in targets:
            t_id = str(t.get("id"))
            provider = t.get("provider", "simplelogin")
            success = False
            if provider == "simplelogin":
                client = SimpleLoginClient(env["simplelogin_key"])
                success = client.delete_alias(t_id)
            elif provider == "anonaddr":
                client = AnonAddyClient(env["anonaddr_key"], env["anonaddr_domain"])
                success = client.delete_alias(t_id)

            if success:
                deleted_ids.add(t_id)
                print(f"  ✅ Deleted: {t.get('alias')} (ID: {t_id})")
            else:
                print(f"  ❌ Failed to delete: {t.get('alias')} (ID: {t_id})")

        updated = [e for e in registry if str(e.get("id")) not in deleted_ids]
        save_registry(updated)
        print(f"\n✨ Deleted {len(deleted_ids)} alias(es). Active registry now has {len(updated)} aliases.")
        print("💡 (Note: Deleted names remain safely in permanent history and will NOT recreate themselves!)\n")
        return

    if not getattr(args, "alias_id", None):
        print("[ERROR] Please provide an alias_id or use `--all` to delete all active aliases.")
        sys.exit(1)

    target = next((e for e in registry if str(e.get("id")) == str(args.alias_id)), None)
    if not target:
        print(f"[ERROR] ID '{args.alias_id}' not found in active registry. Run `python alias_gen.py list` to inspect entries.")
        sys.exit(1)

    provider = target["provider"]
    validate_provider(provider, env)

    print(f"\n🗑  Deleting {target.get('alias', '?')} (ID: {args.alias_id}) via [{provider}]...")
    deleted = False
    if provider == "simplelogin":
        client = SimpleLoginClient(env["simplelogin_key"])
        deleted = client.delete_alias(str(args.alias_id))
    elif provider == "anonaddr":
        client = AnonAddyClient(env["anonaddr_key"], env["anonaddr_domain"])
        deleted = client.delete_alias(str(args.alias_id))

    if deleted:
        updated = [e for e in registry if str(e.get("id")) != str(args.alias_id)]
        save_registry(updated)
        print(f"  ✅ Deleted successfully: {target.get('alias')}")
        print("💡 (Note: Deleted name remains safely in permanent history and will NOT recreate itself!)\n")
    else:
        print("  ❌ API deletion failed. Registry was not modified.\n")


def cmd_config(args, env: dict) -> None:
    print("\n⚙️  Configuration & Account Overview\n")
    print(f"  .env file        : {ENV_FILE}")
    print(f"  Active Registry  : {REGISTRY_FILE}")
    print(f"  Permanent History: {HISTORY_FILE}")
    print(f"  Default Provider : {env['provider']}")
    print(f"  AnonAddy domain  : {env['anonaddr_domain']}")
    print(f"  AnonAddy API Key : {'✅ Set' if env['anonaddr_key'] else '❌ Not set'}")
    print(f"  SimpleLogin Key  : {'✅ Set' if env['simplelogin_key'] else '❌ Not set'}")

    first_pool, last_pool = get_available_pools()
    used_history = get_used_names_set()
    total_combos = len(first_pool) * len(last_pool)
    remaining_combos = max(0, total_combos - len(used_history))

    print(f"\n  📚 Local Name Banks:")
    print(f"        First names      : {len(first_pool)} available (Common, Yoruba, Igbo, Edo)")
    print(f"        Surnames         : {len(last_pool)} available (Common, Igbo)")
    print(f"        Total combos     : {total_combos:,}")
    print(f"        Used in History  : {len(used_history)} names/aliases")
    print(f"        Remaining Fresh  : {remaining_combos:,} combinations available")

    if env["simplelogin_key"]:
        client = SimpleLoginClient(env["simplelogin_key"])
        user_info = client.get_user_info()
        if user_info:
            plan = "👑 Premium" if user_info.get("is_premium") else "🆓 Free"
            active_count = client.get_active_alias_count()
            max_free = user_info.get("max_alias_free_plan", 10)
            email = user_info.get("email", "—")
            print(f"\n  📡 SimpleLogin Status:")
            print(f"        Account  : {email}")
            print(f"        Plan     : {plan}")
            if not user_info.get("is_premium"):
                print(f"        Aliases  : {active_count}/{max_free} active aliases")
            else:
                print(f"        Aliases  : Unlimited")

    registry = load_registry()
    print(f"\n  📁 Active Aliases in Registry: {len(registry)}\n")


# ── Main Entrypoint ───────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Email Alias Generator — Nigerian names + real forwarding email aliases.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Daily Cycle Examples (SimpleLogin Free Tier - 10 active at a time):
  1. Generate today's 10 aliases:
     python alias_gen.py generate --count 10 --label "day-1" --export day1.csv

  2. Auto-fill remaining free spots to reach 10/10:
     python alias_gen.py generate --fill --label "day-1"

  3. Inspect active aliases:
     python alias_gen.py list

  4. Delete all active aliases to reset quota (names stay recorded in history):
     python alias_gen.py delete --all --yes

  5. Generate tomorrow's 10 fresh, non-repeating aliases:
     python alias_gen.py generate --count 10 --label "day-2" --export day2.csv

  6. View all aliases ever created across all cycles:
     python alias_gen.py history
        """,
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # Subcommand: generate
    gen = sub.add_parser("generate", help="Generate aliases paired with Nigerian or imported names")
    gen.add_argument("--count", "-n", type=int, default=5, help="Number of aliases to create (default: 5)")
    gen.add_argument("--fill", action="store_true", help="Auto-fill up to the Free plan quota limit (creates only remaining available spots)")
    gen.add_argument("--label", "-l", type=str, help="Batch label tag (e.g. 'day-1', 'week-1')")
    gen.add_argument("--provider", "-p", choices=["simplelogin", "anonaddr"], help="Override default provider")
    gen.add_argument("--first-names", "--fn", type=str, metavar="FILE", help="Specific first names file (e.g. yoruba_firstnames)")
    gen.add_argument("--surnames", "--sn", "--last-names", type=str, metavar="FILE", help="Specific surnames file (e.g. common_nigerian_surnames)")
    gen.add_argument("--names-file", "-f", type=str, metavar="FILE", help="Combined names file (.csv or .txt)")
    gen.add_argument("--no-mix", action="store_true", help="Preserve exact first/last pairs instead of mixing")
    gen.add_argument("--random-prefix", action="store_true", help="Use random words instead of name-based alias prefix")
    gen.add_argument("--delay", "-d", type=float, default=2.0, help="Delay in seconds between API calls (default: 2.0s to avoid rate limits)")
    gen.add_argument("--export", "-e", type=str, metavar="FILE.csv", help="Export created batch to CSV")

    # Subcommand: names
    names_cmd = sub.add_parser("names", help="Preview Nigerian names or test file mixing without calling API")
    names_cmd.add_argument("--count", "-n", type=int, default=15, help="Number of names to preview (default: 15)")
    names_cmd.add_argument("--first-names", "--fn", type=str, metavar="FILE", help="Specific first names file")
    names_cmd.add_argument("--surnames", "--sn", "--last-names", type=str, metavar="FILE", help="Specific surnames file")
    names_cmd.add_argument("--names-file", "-f", type=str, metavar="FILE", help="Combined names file (.csv or .txt)")
    names_cmd.add_argument("--no-mix", action="store_true", help="Preserve exact original pairs without shuffling")
    names_cmd.add_argument("--export", "-e", type=str, metavar="FILE.csv", help="Export preview names to CSV")

    # Subcommand: list
    lst = sub.add_parser("list", help="List currently active aliases from local registry")
    lst.add_argument("--label", "-l", type=str, help="Filter entries by label")
    lst.add_argument("--export", "-e", type=str, metavar="FILE.csv", help="Export listed entries to CSV")

    # Subcommand: history
    hist = sub.add_parser("history", help="Show all aliases ever created across all cycles (including deleted)")
    hist.add_argument("--export", "-e", type=str, metavar="FILE.csv", help="Export history ledger to CSV")

    # Subcommand: delete
    dlt = sub.add_parser("delete", help="Delete aliases from provider & active registry (names stay in history)")
    dlt.add_argument("alias_id", nargs="?", help="Specific alias ID to delete")
    dlt.add_argument("--all", action="store_true", help="Delete ALL currently active aliases")
    dlt.add_argument("--label", "-l", type=str, help="Delete all active aliases matching label")
    dlt.add_argument("--yes", "-y", action="store_true", help="Confirm deletion without prompting")

    # Subcommand: config
    sub.add_parser("config", help="Show configuration, quota, and history stats")

    args = parser.parse_args()
    env = load_env()

    commands = {
        "generate": cmd_generate,
        "names": cmd_names,
        "list": cmd_list,
        "history": cmd_history,
        "delete": cmd_delete,
        "config": cmd_config,
    }

    commands[args.command](args, env)


if __name__ == "__main__":
    main()
