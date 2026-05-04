const canvas = document.getElementById("rouletteCanvas");
const ctx = canvas.getContext("2d");
const skipSpinBtn = document.getElementById("skipSpinBtn");
const resultText = document.getElementById("resultText");
const betAmountInput = document.getElementById("betAmount");
const balanceAmountInput = document.getElementById("balanceAmount");
const applyBalanceBtn = document.getElementById("applyBalanceBtn");
const steamIdInput = document.getElementById("steamIdInput");
const steamNameInput = document.getElementById("steamNameInput");
const steamLoginBtn = document.getElementById("steamLoginBtn");
const steamLogoutBtn = document.getElementById("steamLogoutBtn");
const authStatusText = document.getElementById("authStatusText");
const playerProfitText = document.getElementById("playerProfitText");
const adminPanel = document.getElementById("adminPanel");
const adminAccountSelect = document.getElementById("adminAccountSelect");
const adminTopUpAmountInput = document.getElementById("adminTopUpAmountInput");
const adminTopUpBtn = document.getElementById("adminTopUpBtn");
const openBetWindowBtn = document.getElementById("openBetWindowBtn");
const stripe1Row = document.getElementById("stripe1Row");
const stripe2Row = document.getElementById("stripe2Row");
const stripe3Row = document.getElementById("stripe3Row");
const clearCellsBtn = document.getElementById("clearCellsBtn");
const setRedBtn = document.getElementById("setRedBtn");
const setBlackBtn = document.getElementById("setBlackBtn");
const setEvenBtn = document.getElementById("setEvenBtn");
const setOddBtn = document.getElementById("setOddBtn");
const setZeroBtn = document.getElementById("setZeroBtn");
const setDoubleZeroBtn = document.getElementById("setDoubleZeroBtn");
const betWindowBackdrop = document.getElementById("betWindowBackdrop");
const betWindowCloseBtn = document.getElementById("betWindowCloseBtn");
const balanceText = document.getElementById("balanceText");
const currentBetText = document.getElementById("currentBetText");
const selectedBetText = document.getElementById("selectedBetText");
const lastWinText = document.getElementById("lastWinText");
const x2HitsText = document.getElementById("x2Hits");
const x3HitsText = document.getElementById("x3Hits");
const x30HitsText = document.getElementById("x30Hits");
const modalBackdrop = document.getElementById("resultModalBackdrop");
const modalTitle = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const withdrawBalanceText = document.getElementById("withdrawBalanceText");
const withdrawFeeText = document.getElementById("withdrawFeeText");
const withdrawNetText = document.getElementById("withdrawNetText");
const openWithdrawModalBtn = document.getElementById("openWithdrawModalBtn");
const withdrawModalBackdrop = document.getElementById("withdrawModalBackdrop");
const withdrawModalMessage = document.getElementById("withdrawModalMessage");
const withdrawModalCloseBtn = document.getElementById("withdrawModalCloseBtn");
const spinHistoryList = document.getElementById("spinHistoryList");
const nextAutoSpinText = document.getElementById("nextAutoSpinText");
const spinEndsInText = document.getElementById("spinEndsInText");
const freezeEndsInText = document.getElementById("freezeEndsInText");

const wheelNumbers = ["1", "25", "7", "13", "12", "6", "18", "10", "11", "14", "2", "5", "27", "30", "24", "21", "33", "8", "36", "17", "31", "15", "4", "20", "19", "9", "32", "26", "29", "34", "3", "16", "22", "23", "28", "35"];
const slots = ["00", ...wheelNumbers.slice(0, 18), "0", ...wheelNumbers.slice(18)];
const stripeA = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
const stripeB = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35];
const stripeC = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];
const total = slots.length;
const sectorAngle = (Math.PI * 2) / total;
const minBet = 100;
const maxBet = 1000;
const spinDurationMs = 7600;
const AUTH_TOKEN_KEY = "roulette_auth_token_v1";
const idleSpinSpeed = 0.0022;

let authToken = localStorage.getItem(AUTH_TOKEN_KEY) || "";
let serverOffset = 0;
let currentRotation = 0;
let spinningVisual = false;
let skipSpinVisual = false;
let currentRound = null;
let currentAccount = null;

const numberBets = {};
const stripeBets = {};
const modifierBets = {};

function apiHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  return headers;
}

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { ...apiHeaders(), ...(options.headers || {}) } });
  let data = {};
  try { data = await response.json(); } catch (_) { data = {}; }
  if (!response.ok) throw new Error(data.error || `HTTP_${response.status}`);
  return data;
}

function showModal(isWin, message) {
  modalTitle.textContent = isWin ? "Готово" : "Ошибка";
  modalMessage.textContent = message;
  modalBackdrop.classList.add("show");
}

function nowMs() { return Date.now() + serverOffset; }
function formatSeconds(ms) { return `${(Math.max(0, ms) / 1000).toFixed(1)}с`; }

function getSlotColorByIndex(index) {
  const value = slots[index];
  if (value === "0" || value === "00") return "#198754";
  return index % 2 === 0 ? "#b63a3a" : "#1a1a1a";
}

function drawWheel(rotation = 0) {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = canvas.width * 0.48;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  for (let i = 0; i < total; i += 1) {
    const value = slots[i];
    const start = i * sectorAngle - Math.PI / 2;
    const end = start + sectorAngle;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = getSlotColorByIndex(i);
    ctx.fill();
    ctx.strokeStyle = "#d5c28c";
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.save();
    const mid = start + sectorAngle / 2;
    const labelRadius = radius * 0.78;
    ctx.rotate(mid);
    ctx.translate(labelRadius, 0);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = "#f6f0dd";
    ctx.font = "bold 15px Segoe UI";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(value, 0, 0);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = "#2b3543";
  ctx.fill();
  ctx.strokeStyle = "#d5c28c";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function buttonActive(el, active) {
  if (active) el.classList.add("active");
  else el.classList.remove("active");
}

function normalizeCurrentBet() {
  const value = Math.floor(Number(betAmountInput.value) || minBet);
  const safeValue = Math.min(maxBet, Math.max(minBet, value));
  betAmountInput.value = String(safeValue);
  return safeValue;
}

function getSelectedSummary() {
  const parts = [];
  if (Object.keys(numberBets).length) parts.push(`числа: ${Object.keys(numberBets).join(", ")}`);
  if (stripeBets.A) parts.push("полоса 3..36");
  if (stripeBets.B) parts.push("полоса 2..35");
  if (stripeBets.C) parts.push("полоса 1..34");
  if (modifierBets.red) parts.push("красные");
  if (modifierBets.black) parts.push("чёрные");
  if (modifierBets.even) parts.push("чётные");
  if (modifierBets.odd) parts.push("нечётные");
  if (modifierBets.zero) parts.push("0");
  if (modifierBets.doubleZero) parts.push("00");
  return parts.length ? parts.join(" | ") : "нет";
}

function calculateWithdraw() {
  const balance = currentAccount ? currentAccount.balance : 0;
  const fee = Math.floor(balance * 0.1);
  const net = Math.max(0, balance - fee);
  return { fee, net };
}

function updateStats() {
  const balance = currentAccount ? currentAccount.balance : 0;
  if (document.activeElement !== balanceAmountInput) balanceAmountInput.value = String(balance);
  const totalPlaced = Object.values(numberBets).reduce((s, n) => s + n, 0)
    + Object.values(stripeBets).reduce((s, n) => s + n, 0)
    + Object.values(modifierBets).reduce((s, n) => s + n, 0);
  balanceText.textContent = `Баланс: ${balance}`;
  currentBetText.textContent = `Текущая ставка: ${normalizeCurrentBet()} | Поставлено: ${totalPlaced}`;
  selectedBetText.textContent = `Выбрано: ${getSelectedSummary()}`;
  lastWinText.textContent = `Последний выигрыш: ${currentAccount ? currentAccount.lastWin : 0}`;
  x2HitsText.textContent = String(currentAccount ? currentAccount.x2Hits : 0);
  x3HitsText.textContent = String(currentAccount ? currentAccount.x3Hits : 0);
  x30HitsText.textContent = String(currentAccount ? currentAccount.x30Hits : 0);
  playerProfitText.textContent = `Профит с рулетки: ${currentAccount ? (currentAccount.rouletteWon - currentAccount.rouletteWagered) : 0}`;
  authStatusText.textContent = currentAccount ? `Статус: ${currentAccount.name} (${currentAccount.steamId})${currentAccount.isAdmin ? " [ADMIN]" : ""}` : "Статус: не авторизован";
  adminPanel.classList.toggle("hidden", !(currentAccount && currentAccount.isAdmin));
  applyBalanceBtn.disabled = true;
  const { fee, net } = calculateWithdraw();
  withdrawBalanceText.textContent = String(balance);
  withdrawFeeText.textContent = String(fee);
  withdrawNetText.textContent = String(net);
}

function updateRoundTimers() {
  if (!currentRound) return;
  const t = nowMs();
  nextAutoSpinText.textContent = formatSeconds(currentRound.nextSpinAt - t);
  spinEndsInText.textContent = formatSeconds(currentRound.spinEndsAt - t);
  freezeEndsInText.textContent = formatSeconds(currentRound.freezeEndsAt - t);
}

function renderSpinHistory(history) {
  spinHistoryList.innerHTML = "";
  if (!history || !history.length) {
    const empty = document.createElement("span");
    empty.textContent = "Пока пусто";
    empty.style.color = "#8fa4b8";
    spinHistoryList.appendChild(empty);
    return;
  }
  history.forEach((item) => {
    const chip = document.createElement("div");
    chip.className = "spin-history-item";
    chip.textContent = item.value;
    chip.style.backgroundColor = item.color;
    spinHistoryList.appendChild(chip);
  });
}

function copyBetsFromServer(myBets) {
  Object.keys(numberBets).forEach((k) => delete numberBets[k]);
  Object.keys(stripeBets).forEach((k) => delete stripeBets[k]);
  Object.keys(modifierBets).forEach((k) => delete modifierBets[k]);
  Object.assign(numberBets, myBets?.numberBets || {});
  Object.assign(stripeBets, myBets?.stripeBets || {});
  Object.assign(modifierBets, myBets?.modifierBets || {});
}

function createNumberButton(value) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cell-btn";
  btn.textContent = String(value);
  btn.style.setProperty("background", getSlotColorByIndex(slots.indexOf(String(value))), "important");
  btn.style.setProperty("color", "#f6f0dd", "important");
  if (numberBets[String(value)]) btn.classList.add("active");
  btn.addEventListener("click", () => {
    if (!currentAccount) return showModal(false, "Нужно войти через Steam.");
    if (currentRound && currentRound.status !== "betting") return showModal(false, "Ставки уже закрыты.");
    const key = String(value);
    if (numberBets[key]) delete numberBets[key];
    else numberBets[key] = normalizeCurrentBet();
    renderBetWindow();
    updateStats();
  });
  return btn;
}

function renderStripeRow(container, values, stripeKey) {
  container.innerHTML = "";
  values.forEach((num) => container.appendChild(createNumberButton(num)));
  const pickBtn = document.createElement("button");
  pickBtn.type = "button";
  pickBtn.className = "row-pick-btn";
  pickBtn.textContent = "Выбрать полосу";
  if (stripeBets[stripeKey]) pickBtn.classList.add("active");
  pickBtn.addEventListener("click", () => {
    if (!currentAccount) return showModal(false, "Нужно войти через Steam.");
    if (currentRound && currentRound.status !== "betting") return showModal(false, "Ставки уже закрыты.");
    if (stripeBets[stripeKey]) delete stripeBets[stripeKey];
    else stripeBets[stripeKey] = normalizeCurrentBet();
    renderBetWindow();
    updateStats();
  });
  container.appendChild(pickBtn);
}

function syncModifierButtons() {
  buttonActive(setRedBtn, Boolean(modifierBets.red));
  buttonActive(setBlackBtn, Boolean(modifierBets.black));
  buttonActive(setEvenBtn, Boolean(modifierBets.even));
  buttonActive(setOddBtn, Boolean(modifierBets.odd));
  buttonActive(setZeroBtn, Boolean(modifierBets.zero));
  buttonActive(setDoubleZeroBtn, Boolean(modifierBets.doubleZero));
}

function renderBetWindow() {
  renderStripeRow(stripe1Row, stripeA, "A");
  renderStripeRow(stripe2Row, stripeB, "B");
  renderStripeRow(stripe3Row, stripeC, "C");
  syncModifierButtons();
}

function getRotationForTargetIndex(targetIndex, startRotation, extraTurns) {
  const fullTurn = Math.PI * 2;
  const startNormalized = ((-startRotation % fullTurn) + fullTurn) % fullTurn;
  const targetNormalized = targetIndex * sectorAngle + sectorAngle / 2;
  const normalizedDelta = ((targetNormalized - startNormalized) + fullTurn) % fullTurn;
  const rotationDelta = (fullTurn - normalizedDelta) % fullTurn;
  return startRotation + extraTurns * fullTurn + rotationDelta;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function startVisualSpin(targetIndex) {
  const startRotation = currentRotation;
  const finalRotation = getRotationForTargetIndex(targetIndex, currentRotation, 6.5);
  const startedAt = performance.now();
  spinningVisual = true;
  skipSpinVisual = false;
  skipSpinBtn.disabled = false;
  resultText.textContent = "Автокрутка...";
  function animate(now) {
    if (!spinningVisual) return;
    if (skipSpinVisual) {
      currentRotation = finalRotation % (Math.PI * 2);
      drawWheel(currentRotation);
      resultText.textContent = "Скип только визуальный. Ждём окончания раунда на сервере.";
      return;
    }
    const t = Math.min((now - startedAt) / spinDurationMs, 1);
    currentRotation = (startRotation + (finalRotation - startRotation) * easeOutCubic(t)) % (Math.PI * 2);
    drawWheel(currentRotation);
    if (t < 1) requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

function finishVisualSpin(resultValue) {
  spinningVisual = false;
  skipSpinBtn.disabled = true;
  resultText.textContent = `Выпало число: ${resultValue}`;
}

function startIdleAnimation() {
  function tick() {
    if (!spinningVisual && currentAccount && currentRound && (currentRound.status === "betting" || currentRound.status === "freeze")) {
      currentRotation = (currentRotation + idleSpinSpeed) % (Math.PI * 2);
      drawWheel(currentRotation);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

async function sendBets() {
  await api("/api/bets", { method: "POST", body: JSON.stringify({ numberBets, stripeBets, modifierBets }) });
  showModal(true, "Ставки приняты на текущий раунд.");
}

async function refreshAdminAccounts() {
  if (!(currentAccount && currentAccount.isAdmin)) return;
  const data = await api("/api/admin/accounts");
  adminAccountSelect.innerHTML = "";
  (data.accounts || []).forEach((a) => {
    const opt = document.createElement("option");
    opt.value = a.steamId;
    opt.textContent = `${a.name} (${a.steamId}) | Баланс: ${a.balance} | Профит: ${a.rouletteNet}`;
    adminAccountSelect.appendChild(opt);
  });
}

async function pollState() {
  try {
    const started = Date.now();
    const data = await api("/api/state", { method: "GET" });
    serverOffset = data.serverNow - started;
    const prevRoundId = currentRound ? currentRound.id : null;
    const prevStatus = currentRound ? currentRound.status : null;
    currentRound = data.round;
    currentAccount = data.account;
    copyBetsFromServer(data.myBets);
    renderSpinHistory(data.history);
    updateStats();
    updateRoundTimers();
    renderBetWindow();

    if (!currentAccount) {
      resultText.textContent = "Войди через Steam, чтобы участвовать.";
    } else if (currentRound.status === "betting") {
      resultText.textContent = "Приём ставок открыт.";
      skipSpinBtn.disabled = true;
      spinningVisual = false;
    } else if (currentRound.status === "spinning") {
      if (!spinningVisual && currentRound.resultIndex != null) startVisualSpin(currentRound.resultIndex);
    } else {
      if (spinningVisual) finishVisualSpin(currentRound.resultValue || "?");
      if (currentRound.status === "freeze") resultText.textContent = `Раунд завершён: ${currentRound.resultValue || "?"}.`;
    }

    if (currentAccount && currentAccount.isAdmin && (prevRoundId !== currentRound.id || prevStatus !== currentRound.status)) {
      await refreshAdminAccounts();
    }
  } catch (_) {
    resultText.textContent = "Ошибка соединения с сервером.";
  }
}

steamLoginBtn.addEventListener("click", async () => {
  try {
    const steamId = String(steamIdInput.value || "").trim();
    const name = String(steamNameInput.value || "").trim();
    if (!/^\d{6,20}$/.test(steamId)) return showModal(false, "Неверный SteamID.");
    const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ steamId, name }) });
    authToken = data.token;
    localStorage.setItem(AUTH_TOKEN_KEY, authToken);
    await pollState();
    if (data.isAdmin) await refreshAdminAccounts();
    showModal(true, "Вход выполнен.");
  } catch (error) {
    showModal(false, `Ошибка входа: ${error.message}`);
  }
});

steamLogoutBtn.addEventListener("click", async () => {
  try { if (authToken) await api("/api/auth/logout", { method: "POST" }); } catch (_) { /* ignore */ }
  authToken = "";
  localStorage.removeItem(AUTH_TOKEN_KEY);
  currentAccount = null;
  updateStats();
});

adminTopUpBtn.addEventListener("click", async () => {
  if (!(currentAccount && currentAccount.isAdmin)) return showModal(false, "Только админ.");
  try {
    const steamId = adminAccountSelect.value;
    const amount = Math.max(1, Math.floor(Number(adminTopUpAmountInput.value) || 0));
    await api("/api/admin/topup", { method: "POST", body: JSON.stringify({ steamId, amount }) });
    await pollState();
    await refreshAdminAccounts();
    showModal(true, "Баланс начислен.");
  } catch (error) {
    showModal(false, `Ошибка начисления: ${error.message}`);
  }
});

skipSpinBtn.addEventListener("click", () => {
  if (!spinningVisual) return;
  skipSpinVisual = true;
});

openBetWindowBtn.addEventListener("click", () => {
  if (!currentAccount) return showModal(false, "Нужно войти через Steam.");
  renderBetWindow();
  betWindowBackdrop.classList.add("show");
});

betWindowCloseBtn.addEventListener("click", async () => {
  try {
    await sendBets();
    betWindowBackdrop.classList.remove("show");
    await pollState();
  } catch (error) {
    showModal(false, `Ставки не сохранены: ${error.message}`);
  }
});

betWindowBackdrop.addEventListener("click", (event) => {
  if (event.target === betWindowBackdrop) betWindowBackdrop.classList.remove("show");
});
modalCloseBtn.addEventListener("click", () => modalBackdrop.classList.remove("show"));
modalBackdrop.addEventListener("click", (event) => {
  if (event.target === modalBackdrop) modalBackdrop.classList.remove("show");
});

clearCellsBtn.addEventListener("click", () => {
  if (!currentAccount) return showModal(false, "Нужно войти через Steam.");
  Object.keys(numberBets).forEach((k) => delete numberBets[k]);
  Object.keys(stripeBets).forEach((k) => delete stripeBets[k]);
  Object.keys(modifierBets).forEach((k) => delete modifierBets[k]);
  renderBetWindow();
  updateStats();
});

function toggleModifierBet(key) {
  if (!currentAccount) return showModal(false, "Нужно войти через Steam.");
  if (currentRound && currentRound.status !== "betting") return showModal(false, "Ставки уже закрыты.");
  if (modifierBets[key]) delete modifierBets[key];
  else modifierBets[key] = normalizeCurrentBet();
  renderBetWindow();
  updateStats();
}

setRedBtn.addEventListener("click", () => toggleModifierBet("red"));
setBlackBtn.addEventListener("click", () => toggleModifierBet("black"));
setEvenBtn.addEventListener("click", () => toggleModifierBet("even"));
setOddBtn.addEventListener("click", () => toggleModifierBet("odd"));
setZeroBtn.addEventListener("click", () => toggleModifierBet("zero"));
setDoubleZeroBtn.addEventListener("click", () => toggleModifierBet("doubleZero"));

applyBalanceBtn.addEventListener("click", () => showModal(false, "Баланс меняет только админ через сервер."));
betAmountInput.addEventListener("input", updateStats);
balanceAmountInput.addEventListener("input", () => { if (!currentAccount) balanceAmountInput.value = "0"; });

openWithdrawModalBtn.addEventListener("click", () => {
  const { fee, net } = calculateWithdraw();
  const balance = currentAccount ? currentAccount.balance : 0;
  withdrawModalMessage.textContent = `Текущий баланс: ${balance}. Комиссия 10%: ${fee}. К получению: ${net}.`;
  withdrawModalBackdrop.classList.add("show");
});
withdrawModalCloseBtn.addEventListener("click", () => withdrawModalBackdrop.classList.remove("show"));
withdrawModalBackdrop.addEventListener("click", (event) => {
  if (event.target === withdrawModalBackdrop) withdrawModalBackdrop.classList.remove("show");
});

drawWheel(0);
updateStats();
startIdleAnimation();
setInterval(updateRoundTimers, 120);
setInterval(pollState, 800);
pollState();
