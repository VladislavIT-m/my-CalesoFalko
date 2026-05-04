const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_STEAM_ID = process.env.ADMIN_STEAM_ID || "76561199323407310";

const SPIN_INTERVAL_MS = 30000;
const SPIN_DURATION_MS = 7600;
const FREEZE_DURATION_MS = 5000;
const MIN_BET = 100;
const MAX_BET = 1000;
const DEFAULT_BALANCE = 1000;
const MAX_HISTORY_ITEMS = 18;

const wheelNumbers = [
  "1", "25", "7", "13", "12", "6", "18", "10", "11",
  "14", "2", "5", "27", "30", "24", "21", "33", "8",
  "36", "17", "31", "15", "4", "20", "19", "9", "32",
  "26", "29", "34", "3", "16", "22", "23", "28", "35"
];
const slots = ["00", ...wheelNumbers.slice(0, 18), "0", ...wheelNumbers.slice(18)];
const stripeA = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
const stripeB = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35];
const stripeC = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];

const redNumbers = new Set();
for (let i = 0; i < slots.length; i += 1) {
  const value = slots[i];
  if (value === "0" || value === "00") continue;
  if (i % 2 === 0) redNumbers.add(Number(value));
}

const accounts = new Map();
const sessions = new Map();
const globalHistory = [];
const betsByRound = new Map();

function now() {
  return Date.now();
}

function getOrCreateAccount(steamId, name = "") {
  if (!accounts.has(steamId)) {
    accounts.set(steamId, {
      steamId,
      name: name || `Player ${steamId.slice(-4)}`,
      balance: DEFAULT_BALANCE,
      rouletteWon: 0,
      rouletteWagered: 0,
      x2Hits: 0,
      x3Hits: 0,
      x30Hits: 0,
      lastWin: 0
    });
  }
  const account = accounts.get(steamId);
  if (name) account.name = name;
  return account;
}

function getSessionToken(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length).trim() || null;
}

function requireUser(req, res, next) {
  const token = getSessionToken(req);
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }
  const steamId = sessions.get(token);
  const account = getOrCreateAccount(steamId);
  req.account = account;
  req.isAdmin = steamId === ADMIN_STEAM_ID;
  return next();
}

let currentRound = null;

function createNextRound(baseTime) {
  const spinStartsAt = Math.ceil(baseTime / SPIN_INTERVAL_MS) * SPIN_INTERVAL_MS;
  const spinEndsAt = spinStartsAt + SPIN_DURATION_MS;
  const freezeEndsAt = spinEndsAt + FREEZE_DURATION_MS;
  const nextSpinAt = spinStartsAt + SPIN_INTERVAL_MS;
  return {
    id: spinStartsAt,
    spinStartsAt,
    spinEndsAt,
    freezeEndsAt,
    nextSpinAt,
    resolved: false,
    resultIndex: null,
    resultValue: null
  };
}

function roundStatus(round, t) {
  if (t < round.spinStartsAt) return "betting";
  if (t < round.spinEndsAt) return "spinning";
  if (t < round.freezeEndsAt) return "freeze";
  return "idle";
}

function resolveRound(round) {
  if (round.resolved) return;
  const resultIndex = Math.floor(Math.random() * slots.length);
  const landedValue = slots[resultIndex];
  const landedNum = Number(landedValue);
  const isZero = landedValue === "0" || landedValue === "00";
  const isRed = !isZero && redNumbers.has(landedNum);
  const isBlack = !isZero && !redNumbers.has(landedNum);
  const isEven = !isZero && landedNum % 2 === 0;
  const isOdd = !isZero && landedNum % 2 === 1;

  const roundBets = betsByRound.get(round.id) || new Map();
  roundBets.forEach((bet, steamId) => {
    const account = getOrCreateAccount(steamId);
    let totalBet = 0;
    let winAmount = 0;

    Object.values(bet.numberBets).forEach((v) => { totalBet += v; });
    Object.values(bet.stripeBets).forEach((v) => { totalBet += v; });
    Object.values(bet.modifierBets).forEach((v) => { totalBet += v; });

    if (account.balance >= totalBet) {
      account.balance -= totalBet;
      account.rouletteWagered += totalBet;
    } else {
      bet.numberBets = {};
      bet.stripeBets = {};
      bet.modifierBets = {};
      totalBet = 0;
    }

    if (bet.numberBets[landedValue]) {
      winAmount += bet.numberBets[landedValue] * 30;
      account.x30Hits += 1;
    }
    if (bet.stripeBets.A && stripeA.includes(landedNum)) {
      winAmount += bet.stripeBets.A * 3;
      account.x3Hits += 1;
    }
    if (bet.stripeBets.B && stripeB.includes(landedNum)) {
      winAmount += bet.stripeBets.B * 3;
      account.x3Hits += 1;
    }
    if (bet.stripeBets.C && stripeC.includes(landedNum)) {
      winAmount += bet.stripeBets.C * 3;
      account.x3Hits += 1;
    }
    if (bet.modifierBets.red && isRed) {
      winAmount += bet.modifierBets.red * 2;
      account.x2Hits += 1;
    }
    if (bet.modifierBets.black && isBlack) {
      winAmount += bet.modifierBets.black * 2;
      account.x2Hits += 1;
    }
    if (bet.modifierBets.even && isEven) {
      winAmount += bet.modifierBets.even * 2;
      account.x2Hits += 1;
    }
    if (bet.modifierBets.odd && isOdd) {
      winAmount += bet.modifierBets.odd * 2;
      account.x2Hits += 1;
    }
    if (bet.modifierBets.zero && landedValue === "0") {
      winAmount += bet.modifierBets.zero * 30;
      account.x30Hits += 1;
    }
    if (bet.modifierBets.doubleZero && landedValue === "00") {
      winAmount += bet.modifierBets.doubleZero * 30;
      account.x30Hits += 1;
    }

    account.lastWin = winAmount;
    account.balance += winAmount;
    account.rouletteWon += winAmount;
  });

  globalHistory.unshift({
    value: landedValue,
    color: (landedValue === "0" || landedValue === "00") ? "#198754" : (resultIndex % 2 === 0 ? "#b63a3a" : "#1a1a1a"),
    at: now()
  });
  if (globalHistory.length > MAX_HISTORY_ITEMS) globalHistory.length = MAX_HISTORY_ITEMS;

  round.resolved = true;
  round.resultIndex = resultIndex;
  round.resultValue = landedValue;
}

function ensureRoundLifecycle() {
  const t = now();
  if (!currentRound) currentRound = createNextRound(t + 1000);

  if (t >= currentRound.spinStartsAt && !currentRound.resolved) resolveRound(currentRound);
  if (t >= currentRound.nextSpinAt) {
    betsByRound.delete(currentRound.id);
    currentRound = createNextRound(t);
  }
}

setInterval(ensureRoundLifecycle, 250);

app.use(express.json());
app.use(express.static(path.resolve(__dirname)));

app.post("/api/auth/login", (req, res) => {
  const steamId = String(req.body?.steamId || "").trim();
  const name = String(req.body?.name || "").trim();
  if (!/^\d{6,20}$/.test(steamId)) {
    return res.status(400).json({ error: "INVALID_STEAM_ID" });
  }
  getOrCreateAccount(steamId, name);
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, steamId);
  return res.json({ token, steamId, isAdmin: steamId === ADMIN_STEAM_ID });
});

app.post("/api/auth/logout", requireUser, (req, res) => {
  const token = getSessionToken(req);
  sessions.delete(token);
  return res.json({ ok: true });
});

app.get("/api/state", (req, res) => {
  ensureRoundLifecycle();
  const t = now();
  const token = getSessionToken(req);
  const steamId = token && sessions.has(token) ? sessions.get(token) : null;
  const account = steamId ? getOrCreateAccount(steamId) : null;
  const round = currentRound;
  const status = roundStatus(round, t);

  const myBets = (steamId && betsByRound.get(round.id)?.get(steamId)) || {
    numberBets: {},
    stripeBets: {},
    modifierBets: {}
  };

  return res.json({
    serverNow: t,
    round: {
      id: round.id,
      status,
      spinStartsAt: round.spinStartsAt,
      spinEndsAt: round.spinEndsAt,
      freezeEndsAt: round.freezeEndsAt,
      nextSpinAt: round.nextSpinAt,
      resultIndex: round.resolved ? round.resultIndex : null,
      resultValue: round.resolved ? round.resultValue : null
    },
    history: globalHistory,
    account: account ? {
      steamId: account.steamId,
      name: account.name,
      balance: account.balance,
      rouletteWon: account.rouletteWon,
      rouletteWagered: account.rouletteWagered,
      x2Hits: account.x2Hits,
      x3Hits: account.x3Hits,
      x30Hits: account.x30Hits,
      lastWin: account.lastWin,
      isAdmin: account.steamId === ADMIN_STEAM_ID
    } : null,
    myBets
  });
});

app.post("/api/bets", requireUser, (req, res) => {
  ensureRoundLifecycle();
  const t = now();
  if (t >= currentRound.spinStartsAt) {
    return res.status(400).json({ error: "BETTING_CLOSED" });
  }

  const numberBets = req.body?.numberBets || {};
  const stripeBets = req.body?.stripeBets || {};
  const modifierBets = req.body?.modifierBets || {};

  const safe = {
    numberBets: {},
    stripeBets: {},
    modifierBets: {}
  };

  let total = 0;
  Object.entries(numberBets).forEach(([k, v]) => {
    if (!slots.includes(String(k))) return;
    const n = Math.floor(Number(v) || 0);
    if (n < MIN_BET || n > MAX_BET) return;
    safe.numberBets[k] = n;
    total += n;
  });
  ["A", "B", "C"].forEach((k) => {
    const n = Math.floor(Number(stripeBets[k]) || 0);
    if (n < MIN_BET || n > MAX_BET) return;
    safe.stripeBets[k] = n;
    total += n;
  });
  ["red", "black", "even", "odd", "zero", "doubleZero"].forEach((k) => {
    const n = Math.floor(Number(modifierBets[k]) || 0);
    if (n < MIN_BET || n > MAX_BET) return;
    safe.modifierBets[k] = n;
    total += n;
  });

  if (total <= 0) return res.status(400).json({ error: "EMPTY_BETS" });
  if (req.account.balance < total) return res.status(400).json({ error: "INSUFFICIENT_BALANCE", need: total });

  if (!betsByRound.has(currentRound.id)) betsByRound.set(currentRound.id, new Map());
  betsByRound.get(currentRound.id).set(req.account.steamId, safe);
  return res.json({ ok: true, roundId: currentRound.id, total });
});

app.post("/api/admin/topup", requireUser, (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: "FORBIDDEN" });
  const steamId = String(req.body?.steamId || "").trim();
  const amount = Math.floor(Number(req.body?.amount) || 0);
  if (!/^\d{6,20}$/.test(steamId)) return res.status(400).json({ error: "INVALID_STEAM_ID" });
  if (amount <= 0) return res.status(400).json({ error: "INVALID_AMOUNT" });
  const account = getOrCreateAccount(steamId);
  account.balance += amount;
  return res.json({ ok: true, steamId, balance: account.balance });
});

app.get("/api/admin/accounts", requireUser, (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: "FORBIDDEN" });
  return res.json({
    accounts: Array.from(accounts.values()).map((a) => ({
      steamId: a.steamId,
      name: a.name,
      balance: a.balance,
      rouletteNet: a.rouletteWon - a.rouletteWagered
    }))
  });
});

app.listen(PORT, () => {
  ensureRoundLifecycle();
  console.log(`Server started on http://localhost:${PORT}`);
});
