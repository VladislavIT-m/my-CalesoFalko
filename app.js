const canvas = document.getElementById("rouletteCanvas");
const ctx = canvas.getContext("2d");
const spinBtn = document.getElementById("spinBtn");
const skipSpinBtn = document.getElementById("skipSpinBtn");
const resultText = document.getElementById("resultText");
const betAmountInput = document.getElementById("betAmount");
const balanceAmountInput = document.getElementById("balanceAmount");
const applyBalanceBtn = document.getElementById("applyBalanceBtn");
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
const total = slots.length;
const sectorAngle = (Math.PI * 2) / total;

let currentRotation = 0;
let spinning = false;
let skipSpinRequested = false;
let forceFinishSpin = null;
let holdUntilTimestamp = 0;
let spinEndsAtTimestamp = 0;
let nextAutoSpinAtTimestamp = Date.now() + 20000;
let balance = 1000;
let lastWin = 0;
let x2Hits = 0;
let x3Hits = 0;
let x30Hits = 0;
const minBet = 100;
const maxBet = 1000;
const numberBets = new Map();
const stripeBets = new Map();
const modifierBets = new Map();
const spinHistory = [];
const maxHistoryItems = 18;
const idleSpinSpeed = 0.0024;
const spinDurationMs = 7600;
const autoSpinDelayMs = 20000;
const freezeAfterSpinMs = 5000;

function getSlotColorByIndex(index) {
  const value = slots[index];
  if (value === "0" || value === "00") return "#198754";
  return index % 2 === 0 ? "#b63a3a" : "#1a1a1a";
}

const redNumbers = new Set();
for (let i = 0; i < slots.length; i += 1) {
  const value = slots[i];
  if (value === "0" || value === "00") continue;
  if (getSlotColorByIndex(i) === "#b63a3a") redNumbers.add(Number(value));
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

function pickWeightedIndex() {
  const weights = slots.map((value) => (value === "0" || value === "00" ? 0.08 : 1));
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  let rnd = Math.random() * weightSum;
  for (let i = 0; i < weights.length; i += 1) {
    rnd -= weights[i];
    if (rnd <= 0) return i;
  }
  return weights.length - 1;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function getIndexAtPointer(rotation) {
  const fullTurn = Math.PI * 2;
  const normalized = ((-rotation % fullTurn) + fullTurn) % fullTurn;
  return Math.floor(normalized / sectorAngle) % total;
}

function showModal(isWin, message) {
  modalTitle.textContent = isWin ? "Удача!" : "Неудача";
  modalMessage.textContent = message;
  modalBackdrop.classList.add("show");
}

function buttonActive(el, active) {
  if (active) el.classList.add("active");
  else el.classList.remove("active");
}

function syncModifierButtons() {
  buttonActive(setRedBtn, modifierBets.has("red"));
  buttonActive(setBlackBtn, modifierBets.has("black"));
  buttonActive(setEvenBtn, modifierBets.has("even"));
  buttonActive(setOddBtn, modifierBets.has("odd"));
  buttonActive(setZeroBtn, modifierBets.has("zero"));
  buttonActive(setDoubleZeroBtn, modifierBets.has("doubleZero"));
}

function normalizeCurrentBet() {
  const value = Math.floor(Number(betAmountInput.value) || minBet);
  const safeValue = Math.min(maxBet, Math.max(minBet, value));
  betAmountInput.value = String(safeValue);
  return safeValue;
}

function normalizeBalanceInput() {
  const value = Math.floor(Number(balanceAmountInput.value) || 0);
  const safeValue = Math.max(0, value);
  balanceAmountInput.value = String(safeValue);
  return safeValue;
}

function calculateWithdraw() {
  const fee = Math.floor(balance * 0.1);
  const net = Math.max(0, balance - fee);
  return { fee, net };
}

function formatSeconds(ms) {
  return `${(Math.max(0, ms) / 1000).toFixed(1)}с`;
}

function updateAutoSpinTimers() {
  const now = Date.now();
  nextAutoSpinText.textContent = formatSeconds(nextAutoSpinAtTimestamp - now);
  spinEndsInText.textContent = spinning ? formatSeconds(spinEndsAtTimestamp - now) : "0.0с";
  freezeEndsInText.textContent = now < holdUntilTimestamp ? formatSeconds(holdUntilTimestamp - now) : "0.0с";
}

function getRotationForTargetIndex(targetIndex, startRotation, extraTurns) {
  const fullTurn = Math.PI * 2;
  const startNormalized = ((-startRotation % fullTurn) + fullTurn) % fullTurn;
  const targetNormalized = targetIndex * sectorAngle + sectorAngle / 2;
  const normalizedDelta = ((targetNormalized - startNormalized) + fullTurn) % fullTurn;
  const rotationDelta = (fullTurn - normalizedDelta) % fullTurn;
  return startRotation + extraTurns * fullTurn + rotationDelta;
}

function renderSpinHistory() {
  spinHistoryList.innerHTML = "";
  if (!spinHistory.length) {
    const empty = document.createElement("span");
    empty.textContent = "Пока пусто";
    empty.style.color = "#8fa4b8";
    spinHistoryList.appendChild(empty);
    return;
  }

  spinHistory.forEach((item) => {
    const chip = document.createElement("div");
    chip.className = "spin-history-item";
    chip.textContent = item.value;
    chip.style.backgroundColor = item.color;
    spinHistoryList.appendChild(chip);
  });
}

function getSelectedSummary() {
  const parts = [];
  if (numberBets.size) parts.push(`числа: ${Array.from(numberBets.keys()).join(", ")}`);
  if (stripeBets.has("A")) parts.push("полоса 3..36");
  if (stripeBets.has("B")) parts.push("полоса 2..35");
  if (stripeBets.has("C")) parts.push("полоса 1..34");
  if (modifierBets.has("red")) parts.push("красные");
  if (modifierBets.has("black")) parts.push("чёрные");
  if (modifierBets.has("even")) parts.push("чётные");
  if (modifierBets.has("odd")) parts.push("нечётные");
  if (modifierBets.has("zero")) parts.push("0");
  if (modifierBets.has("doubleZero")) parts.push("00");
  return parts.length ? parts.join(" | ") : "нет";
}

function updateStats() {
  const currentBet = normalizeCurrentBet();
  if (document.activeElement !== balanceAmountInput) {
    balanceAmountInput.value = String(balance);
  } else {
    normalizeBalanceInput();
  }
  const totalPlaced = [...numberBets.values(), ...stripeBets.values(), ...modifierBets.values()]
    .reduce((sum, bet) => sum + bet, 0);
  balanceText.textContent = `Баланс: ${balance}`;
  currentBetText.textContent = `Текущая ставка: ${currentBet} | Поставлено: ${totalPlaced}`;
  selectedBetText.textContent = `Выбрано: ${getSelectedSummary()}`;
  lastWinText.textContent = `Последний выигрыш: ${lastWin}`;
  x2HitsText.textContent = String(x2Hits);
  x3HitsText.textContent = String(x3Hits);
  x30HitsText.textContent = String(x30Hits);
  const { fee, net } = calculateWithdraw();
  withdrawBalanceText.textContent = String(balance);
  withdrawFeeText.textContent = String(fee);
  withdrawNetText.textContent = String(net);
  updateAutoSpinTimers();
}

function createNumberButton(value) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cell-btn";
  btn.textContent = String(value);
  if (numberBets.has(String(value))) btn.classList.add("active");
  btn.addEventListener("click", () => {
    const key = String(value);
    if (numberBets.has(key)) {
      numberBets.delete(key);
    } else {
      numberBets.set(key, normalizeCurrentBet());
    }
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
  if (stripeBets.has(stripeKey)) pickBtn.classList.add("active");
  pickBtn.addEventListener("click", () => {
    if (stripeBets.has(stripeKey)) {
      stripeBets.delete(stripeKey);
    } else {
      stripeBets.set(stripeKey, normalizeCurrentBet());
    }
    renderBetWindow();
    updateStats();
  });
  container.appendChild(pickBtn);
}

function renderBetWindow() {
  renderStripeRow(stripe1Row, stripeA, "A");
  renderStripeRow(stripe2Row, stripeB, "B");
  renderStripeRow(stripe3Row, stripeC, "C");
  syncModifierButtons();
}

function totalSelectedBets() {
  const cellTotal = [...numberBets.values()].reduce((sum, bet) => sum + bet, 0);
  const modTotal = [...stripeBets.values(), ...modifierBets.values()]
    .reduce((sum, bet) => sum + bet, 0);
  return { cellTotal, modTotal };
}

function startIdleAnimation() {
  function tick() {
    const now = Date.now();

    if (!spinning && now >= nextAutoSpinAtTimestamp) {
      spin({ auto: true });
    }

    if (!spinning && now >= holdUntilTimestamp) {
      currentRotation = (currentRotation + idleSpinSpeed) % (Math.PI * 2);
      drawWheel(currentRotation);
    }
    updateAutoSpinTimers();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function spin(options = {}) {
  const { auto = false } = options;
  if (spinning) return;
  normalizeCurrentBet();
  const { cellTotal, modTotal } = totalSelectedBets();
  const hasAnyBet = cellTotal + modTotal > 0;
  let useBets = hasAnyBet;

  if (!hasAnyBet && !auto) {
    showModal(false, "Сначала выбери хотя бы одну ставку в окне.");
    return;
  }

  const totalBet = hasAnyBet ? cellTotal + modTotal : 0;
  if (balance < totalBet && !auto) {
    showModal(false, `Недостаточно баланса. Нужно: ${totalBet}`);
    return;
  }
  if (balance < totalBet && auto) useBets = false;

  spinning = true;
  skipSpinRequested = false;
  spinEndsAtTimestamp = Date.now() + spinDurationMs;
  spinBtn.disabled = true;
  skipSpinBtn.disabled = false;
  betAmountInput.disabled = true;
  resultText.textContent = auto ? "Автокрутка..." : "Колесо крутится...";
  balance -= useBets ? totalBet : 0;
  updateStats();

  const targetIndex = pickWeightedIndex();
  const extraSpins = 6 + Math.random() * 2;
  const finalRotation = getRotationForTargetIndex(targetIndex, currentRotation, extraSpins);
  const duration = spinDurationMs;
  const startTime = performance.now();
  const startRotation = currentRotation;
  let completed = false;

  function finishSpin() {
    if (completed) return;
    completed = true;
    forceFinishSpin = null;
    spinEndsAtTimestamp = 0;

    currentRotation = finalRotation % (Math.PI * 2);
    drawWheel(currentRotation);
    const landedIndex = getIndexAtPointer(currentRotation);
    const landedValue = slots[landedIndex];
    const landedNum = Number(landedValue);
    const isZero = landedValue === "0" || landedValue === "00";
    const isRed = !isZero && redNumbers.has(landedNum);
    const isBlack = !isZero && !redNumbers.has(landedNum);
    const isEven = !isZero && landedNum % 2 === 0;
    const isOdd = !isZero && landedNum % 2 === 1;

    let winAmount = 0;
    const wins = [];

    if (useBets && numberBets.has(landedValue)) {
      winAmount += numberBets.get(landedValue) * 30;
      x30Hits += 1;
      wins.push(`число ${landedValue} x30`);
    }
    if (useBets && stripeBets.has("A") && stripeA.includes(landedNum)) {
      winAmount += stripeBets.get("A") * 3;
      x3Hits += 1;
      wins.push("полоса 3..36 x3");
    }
    if (useBets && stripeBets.has("B") && stripeB.includes(landedNum)) {
      winAmount += stripeBets.get("B") * 3;
      x3Hits += 1;
      wins.push("полоса 2..35 x3");
    }
    if (useBets && stripeBets.has("C") && stripeC.includes(landedNum)) {
      winAmount += stripeBets.get("C") * 3;
      x3Hits += 1;
      wins.push("полоса 1..34 x3");
    }
    if (useBets && modifierBets.has("red") && isRed) {
      winAmount += modifierBets.get("red") * 2;
      x2Hits += 1;
      wins.push("красные x2");
    }
    if (useBets && modifierBets.has("black") && isBlack) {
      winAmount += modifierBets.get("black") * 2;
      x2Hits += 1;
      wins.push("чёрные x2");
    }
    if (useBets && modifierBets.has("even") && isEven) {
      winAmount += modifierBets.get("even") * 2;
      x2Hits += 1;
      wins.push("чётные x2");
    }
    if (useBets && modifierBets.has("odd") && isOdd) {
      winAmount += modifierBets.get("odd") * 2;
      x2Hits += 1;
      wins.push("нечётные x2");
    }
    if (useBets && modifierBets.has("zero") && landedValue === "0") {
      winAmount += modifierBets.get("zero") * 30;
      x30Hits += 1;
      wins.push("0 x30");
    }
    if (useBets && modifierBets.has("doubleZero") && landedValue === "00") {
      winAmount += modifierBets.get("doubleZero") * 30;
      x30Hits += 1;
      wins.push("00 x30");
    }

    lastWin = winAmount;
    spinHistory.unshift({
      value: landedValue,
      color: getSlotColorByIndex(landedIndex)
    });
    if (spinHistory.length > maxHistoryItems) spinHistory.length = maxHistoryItems;
    renderSpinHistory();
    balance += winAmount;
    spinning = false;
    skipSpinRequested = false;
    holdUntilTimestamp = Date.now() + freezeAfterSpinMs;
    nextAutoSpinAtTimestamp = holdUntilTimestamp + autoSpinDelayMs;
    spinBtn.disabled = false;
    skipSpinBtn.disabled = true;
    betAmountInput.disabled = false;
    resultText.textContent = `Выпало число: ${landedValue}`;
    updateStats();

    if (wins.length && !auto) {
      showModal(true, `Выпало ${landedValue}. Сыграло: ${wins.join(", ")}. Выигрыш: ${winAmount}`);
    } else if (!wins.length && !auto && useBets) {
      showModal(false, `Выпало ${landedValue}. Ни одна ставка не сыграла.`);
    }
  }

  forceFinishSpin = () => {
    skipSpinRequested = true;
    finishSpin();
  };

  function animate(now) {
    if (completed) return;

    if (skipSpinRequested) {
      finishSpin();
      return;
    }

    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    const angle = startRotation + (finalRotation - startRotation) * easeOutCubic(t);
    currentRotation = angle % (Math.PI * 2);
    drawWheel(currentRotation);

    if (t < 1) {
      requestAnimationFrame(animate);
      return;
    }

    finishSpin();
  }

  requestAnimationFrame(animate);
}

spinBtn.addEventListener("click", () => spin({ auto: false }));
skipSpinBtn.addEventListener("click", () => {
  if (!spinning) return;
  if (forceFinishSpin) forceFinishSpin();
  else skipSpinRequested = true;
});
openBetWindowBtn.addEventListener("click", () => {
  renderBetWindow();
  betWindowBackdrop.classList.add("show");
});
betWindowCloseBtn.addEventListener("click", () => {
  betWindowBackdrop.classList.remove("show");
});
betWindowBackdrop.addEventListener("click", (event) => {
  if (event.target === betWindowBackdrop) betWindowBackdrop.classList.remove("show");
});
modalCloseBtn.addEventListener("click", () => {
  modalBackdrop.classList.remove("show");
});
modalBackdrop.addEventListener("click", (event) => {
  if (event.target === modalBackdrop) modalBackdrop.classList.remove("show");
});

clearCellsBtn.addEventListener("click", () => {
  numberBets.clear();
  stripeBets.clear();
  modifierBets.clear();
  renderBetWindow();
  updateStats();
});

setRedBtn.addEventListener("click", () => {
  if (modifierBets.has("red")) modifierBets.delete("red");
  else modifierBets.set("red", normalizeCurrentBet());
  renderBetWindow();
  updateStats();
});
setBlackBtn.addEventListener("click", () => {
  if (modifierBets.has("black")) modifierBets.delete("black");
  else modifierBets.set("black", normalizeCurrentBet());
  renderBetWindow();
  updateStats();
});
setEvenBtn.addEventListener("click", () => {
  if (modifierBets.has("even")) modifierBets.delete("even");
  else modifierBets.set("even", normalizeCurrentBet());
  renderBetWindow();
  updateStats();
});
setOddBtn.addEventListener("click", () => {
  if (modifierBets.has("odd")) modifierBets.delete("odd");
  else modifierBets.set("odd", normalizeCurrentBet());
  renderBetWindow();
  updateStats();
});
setZeroBtn.addEventListener("click", () => {
  if (modifierBets.has("zero")) modifierBets.delete("zero");
  else modifierBets.set("zero", normalizeCurrentBet());
  renderBetWindow();
  updateStats();
});
setDoubleZeroBtn.addEventListener("click", () => {
  if (modifierBets.has("doubleZero")) modifierBets.delete("doubleZero");
  else modifierBets.set("doubleZero", normalizeCurrentBet());
  renderBetWindow();
  updateStats();
});
applyBalanceBtn.addEventListener("click", () => {
  if (spinning) {
    showModal(false, "Нельзя менять баланс во время вращения.");
    return;
  }
  balance = normalizeBalanceInput();
  updateStats();
});
betAmountInput.addEventListener("input", updateStats);
balanceAmountInput.addEventListener("input", normalizeBalanceInput);
openWithdrawModalBtn.addEventListener("click", () => {
  const { fee, net } = calculateWithdraw();
  withdrawModalMessage.textContent = `Текущий баланс: ${balance}. Комиссия 10%: ${fee}. К получению: ${net}.`;
  withdrawModalBackdrop.classList.add("show");
});
withdrawModalCloseBtn.addEventListener("click", () => {
  withdrawModalBackdrop.classList.remove("show");
});
withdrawModalBackdrop.addEventListener("click", (event) => {
  if (event.target === withdrawModalBackdrop) withdrawModalBackdrop.classList.remove("show");
});

renderBetWindow();
updateStats();
renderSpinHistory();
startIdleAnimation();
