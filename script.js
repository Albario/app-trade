console.log("JS CARICATO");

// 🔑 API KEY TwelveData
const API_KEY = "10855c271c7546378bb4ecc6eb22b595";

// Coppie valutarie
const SYMBOLS = [
  { symbol: "EUR/USD", label: "EUR/USD" },
  { symbol: "GBP/USD", label: "GBP/USD" },
  { symbol: "USD/JPY", label: "USD/JPY" },
  { symbol: "AUD/USD", label: "AUD/USD" }
];

const state = {};
SYMBOLS.forEach(s => state[s.label] = { candles: [] });

/* ------------------------------
   CORREZIONE ORARIO UTC → LOCALE
--------------------------------*/
function fixTime(dateString) {
  const d = new Date(dateString);
  return new Date(d.getTime() + (60 * 60 * 1000)); // +1 ora
}

/* ------------------------------
   EMA
--------------------------------*/
function calcEMA(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let ema = values[0];
  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

/* ------------------------------
   RSI
--------------------------------*/
function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = closes.length - period - 1; i < closes.length - 1; i++) {
    const diff = closes[i + 1] - closes[i];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/* ------------------------------
   FORMULA AGGRESSIVA DEFINITIVA
--------------------------------*/
function generaSegnale(rsi, ema20, ema50) {

  const perc = ((ema20 - ema50) / ema50) * 100; // Trend %
  const rsiStrength = (rsi - 50) * 1.6;         // RSI %

  let score = 50;
  score += perc * 2.2;        // Trend più pesante
  score += rsiStrength * 1.1; // RSI più incisivo

  // Filtro direzionale semplice
  if (ema20 > ema50) score += 4;
  if (ema20 < ema50) score -= 4;

  let tipo = "NEUTRO";

  if (score >= 65 && perc > 0) tipo = "STRONG_BUY";
  if (score >= 65 && perc < 0) tipo = "STRONG_SELL";

  if (score >= 60 && score < 65 && perc > 0) tipo = "BUY";
  if (score >= 60 && score < 65 && perc < 0) tipo = "SELL";

  if (score >= 55 && score < 60) tipo = "WEAK";

  const start = new Date();
  const end = new Date(start.getTime() + 5 * 60000);

  return { tipo, score, perc, rsiStrength, start, end, duration: 5 };
}

/* ------------------------------
   STAMPA SEGNALI COMPATTI
--------------------------------*/
function stampaSegnale(label, segnale) {

  const tbody = document.getElementById("signals");
  const tr = document.createElement("tr");

  tr.className = segnale.tipo.toLowerCase();
  tr.dataset.end = segnale.end.getTime();

  tr.innerHTML = `
    <td>${segnale.start.toISOString().replace("T"," ").substring(0,19)}</td>
    <td>${label}</td>
    <td>${segnale.tipo}</td>
    <td>${segnale.score.toFixed(2)}</td>
    <td>${segnale.perc.toFixed(2)}%</td>
    <td>${segnale.end.toISOString().replace("T"," ").substring(0,19)}</td>
    <td class="countdown">${segnale.duration}m 00s</td>
  `;

  tbody.prepend(tr);

  // SUONI
  if (segnale.tipo === "STRONG_BUY" || segnale.tipo === "BUY") {
    document.getElementById("soundBuy").play();
  }
  if (segnale.tipo === "STRONG_SELL" || segnale.tipo === "SELL") {
    document.getElementById("soundSell").play();
  }
  if (segnale.tipo === "WEAK") {
    document.getElementById("soundWeak").play();
  }

  // Mantieni massimo 15 segnali
  const rows = document.querySelectorAll("#signals tr");
  if (rows.length > 15) {
    rows[rows.length - 1].remove();
  }
}

/* ------------------------------
   FETCH DATI (ROUND ROBIN)
--------------------------------*/
let index = 0;

async function fetchData() {
  const s = SYMBOLS[index];
  index = (index + 1) % SYMBOLS.length;

  document.getElementById("statusText").textContent =
    "Aggiornamento: " + s.label;

  const url =
    `https://api.twelvedata.com/time_series?symbol=${s.symbol}&interval=1min&apikey=${API_KEY}`;

  try {
    const res = await fetch(url);
    const json = await res.json();

    console.log("RISPOSTA API:", json);

    if (!json.values) return;

    document.getElementById("lastUpdate").textContent =
      "Ultimo aggiornamento: " + new Date().toLocaleTimeString();

    const candles = json.values.map(c => ({
      time: fixTime(c.datetime).getTime(),
      close: parseFloat(c.close)
    }));

    candles.sort((a, b) => a.time - b.time);
    state[s.label].candles = candles;

    const dot = document.getElementById("statusDot");
    dot.style.background = "#2ecc71";
    setTimeout(() => dot.style.background = "#555", 1000);

    if (candles.length > 25) {
      const closes = candles.map(c => c.close);
      const ema20 = calcEMA(closes.slice(-25), 20);
      const ema50 = calcEMA(closes.slice(-25), 20); // EMA50 simulata
      const rsi = calcRSI(closes, 14);

      if (ema20 && ema50 && rsi !== null) {
        const segnale = generaSegnale(rsi, ema20, ema50);
        stampaSegnale(s.label, segnale);
      }
    }

  } catch (e) {
    console.error("Errore:", e);
  }
}

/* ------------------------------
   TIMER FETCH
--------------------------------*/
setInterval(fetchData, 60000);
fetchData();

/* ------------------------------
   COUNTDOWN + CANCELLAZIONE SCADUTI
--------------------------------*/
setInterval(() => {
  const rows = document.querySelectorAll("[data-end]");
  const now = Date.now();

  rows.forEach(row => {
    const end = parseInt(row.dataset.end);
    const diff = end - now;

    if (diff <= 0) {
      row.remove();
      return;
    }

    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    row.querySelector(".countdown").textContent =
      `${m}m ${s < 10 ? "0" : ""}${s}s`;
  });
}, 1000);

/* ------------------------------
   PULSANTE REFRESH
--------------------------------*/
document.getElementById("refreshBtn").addEventListener("click", () => {
  fetchData();
  const btn = document.getElementById("refreshBtn");
  btn.textContent = "⏳ Aggiornamento...";
  setTimeout(() => btn.textContent = "🔄 Aggiorna ora", 1500);
});

/* ------------------------------
   FILTRI SEGNALI
--------------------------------*/
document.querySelectorAll(".filters button").forEach(btn => {
  btn.addEventListener("click", () => {
    const filter = btn.dataset.filter;

    document.querySelectorAll("#signals tr").forEach(row => {
      if (filter === "all") {
        row.style.display = "";
      } else {
        row.style.display = row.classList.contains(filter) ? "" : "none";
      }
    });
  });
});
