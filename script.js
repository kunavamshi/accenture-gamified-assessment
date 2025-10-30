(function () {
  'use strict';

  // DOM refs
  const board = document.getElementById('board');
  const overlay = document.getElementById('overlay');
  const gameOver = document.getElementById('gameOver');
  const startBtn = document.getElementById('startBtn');
  const playAgainBtn = document.getElementById('playAgainBtn');
  const roundEl = document.getElementById('round');
  const scoreEl = document.getElementById('score');
  const timerEl = document.getElementById('timer');
  const highScoreEl = document.getElementById('highScore');
  const finalScoreEl = document.getElementById('finalScore');
  const bestScoreEl = document.getElementById('bestScore');

  // Game constants
  const TOTAL_ROUNDS = 25;
  const TIME_PER_ROUND = 15; // seconds
  const PENALTY_SECONDS = 2; // on wrong selection
  const POINTS_PER_SEQUENCE = 10;

  // State
  let currentRound = 0;
  let score = 0;
  let highScore = 0;
  let remaining = TIME_PER_ROUND;
  let timerId = null;
  let targetOrder = []; // sorted ascending evaluated results for the round
  let nextIndex = 0; // index into targetOrder for next correct
  let acceptingInput = false;

  // Storage
  const HIGH_KEY = 'bubble_selection_high_score_v1';
  try {
    const stored = localStorage.getItem(HIGH_KEY);
    highScore = stored ? parseInt(stored, 10) : 0;
  } catch {}
  updateText(highScoreEl, String(highScore));

  // Event bindings
  startBtn.addEventListener('click', startGame, { passive: true });
  playAgainBtn.addEventListener('click', startGame, { passive: true });

  function startGame() {
    // Reset state
    currentRound = 0;
    score = 0;
    updateText(scoreEl, '0');
    updateText(roundEl, `0 / ${TOTAL_ROUNDS}`);
    hideOverlay(overlay);
    hideOverlay(gameOver);

    // Kick off first round
    nextRound();
  }

  function nextRound() {
    stopTimer();
    currentRound += 1;
    if (currentRound > TOTAL_ROUNDS) {
      return endGame();
    }

    // UI transition
    board.classList.remove('fade-in');
    board.classList.add('fade-out');

    // Slight delay for smoothness
    setTimeout(() => {
      // Generate new round
      const count = getBubbleCountForRound(currentRound);
      let expressions = generateExpressionsForRound(currentRound, count);
      targetOrder = expressions
        .map(x => x.value)
        .slice()
        .sort((a, b) => a - b);
      nextIndex = 0;
      acceptingInput = true;

      // Shuffle the display order of bubbles
      expressions = shuffleArray(expressions);

      // Render
      renderBoardExpressions(expressions);
      updateText(roundEl, `${currentRound} / ${TOTAL_ROUNDS}`);
      remaining = TIME_PER_ROUND;
      updateText(timerEl, String(remaining));

      // Start countdown
      startTimer();

      board.classList.remove('fade-out');
      board.classList.add('fade-in');
    }, 180);
  }

  function endGame() {
    stopTimer();
    acceptingInput = false;
    updateText(finalScoreEl, String(score));
    // Persist high score
    if (score > highScore) {
      highScore = score;
      updateText(highScoreEl, String(highScore));
      try { localStorage.setItem(HIGH_KEY, String(highScore)); } catch {}
    }
    updateText(bestScoreEl, String(highScore));
    showOverlay(gameOver);
  }

  function startTimer() {
    stopTimer();
    timerId = setInterval(() => {
      remaining -= 1;
      if (remaining < 0) remaining = 0;
      updateText(timerEl, String(remaining));
      if (remaining <= 0) {
        stopTimer();
        acceptingInput = false;
        // Move to next round automatically
        setTimeout(nextRound, 350);
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function renderBoard(numbers) {
    board.innerHTML = '';
    const frag = document.createDocumentFragment();

    for (const num of numbers) {
      const btn = document.createElement('button');
      btn.className = 'bubble';
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-label', `Bubble ${num}`);
      btn.dataset.value = String(num);
      const span = document.createElement('span');
      span.textContent = String(num);
      btn.appendChild(span);

      // Unified pointer/click handling
      btn.addEventListener('click', onBubbleSelect, { passive: true });
      btn.addEventListener('touchstart', (e) => { /* ensure quick tap */ }, { passive: true });

      frag.appendChild(btn);
    }
    board.appendChild(frag);
  }

  function renderBoardExpressions(items) {
    board.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const item of items) {
      const btn = document.createElement('button');
      btn.className = 'bubble';
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-label', `Expression ${item.expr} equals ${item.value}`);
      btn.dataset.value = String(item.value);
      btn.dataset.expr = item.expr;
      const span = document.createElement('span');
      span.textContent = item.expr;
      btn.appendChild(span);

      btn.addEventListener('click', onBubbleSelect, { passive: true });
      btn.addEventListener('touchstart', () => {}, { passive: true });
      frag.appendChild(btn);
    }
    board.appendChild(frag);
  }

  function onBubbleSelect(e) {
    if (!acceptingInput) return;
    const target = e.currentTarget;
    if (!(target instanceof HTMLElement)) return;

    const value = parseFloat(target.dataset.value || '');
    const expected = targetOrder[nextIndex];

    // Account for floating point precision issues with isClose
    if (isClose(value, expected)) {
      // Correct selection
      target.classList.add('correct');
      target.disabled = true;
      nextIndex += 1;

      // Completed sequence
      if (nextIndex >= targetOrder.length) {
        acceptingInput = false;
        score += POINTS_PER_SEQUENCE;
        updateText(scoreEl, String(score));
        // Brief pause then next round
        setTimeout(nextRound, 420);
      }
    } else {
      // Wrong selection: flash red, deduct time
      flashWrong(target);
      applyPenalty();
    }
  }

  // Helper for float comparison
  function isClose(val1, val2, eps = 0.01) {
    return Math.abs(val1 - val2) < eps;
  }

  function flashWrong(el) {
    el.classList.remove('wrong');
    // force reflow for restart animation
    // eslint-disable-next-line no-unused-expressions
    void el.offsetWidth;
    el.classList.add('wrong');
  }

  function applyPenalty() {
    remaining = Math.max(0, remaining - PENALTY_SECONDS);
    updateText(timerEl, String(remaining));
    if (remaining <= 0) {
      stopTimer();
      acceptingInput = false;
      setTimeout(nextRound, 250);
    }
  }

  // Utils
  function updateText(node, text) {
    if (!node) return;
    node.textContent = text;
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function generateNumbers(minCount, maxCount, rangeMin, rangeMax) {
    const count = randomInt(minCount, maxCount);
    const seen = new Set();
    while (seen.size < count) {
      seen.add(randomInt(rangeMin, rangeMax));
    }
    return Array.from(seen);
  }

  // Difficulty scaling
  function getBubbleCountForRound(round) {
    // Always exactly 3 bubbles per round
    return 3;
  }

  function getOperatorSetForRound(round) {
    // Always use all ops, including power ('^')
    return ['+', '-', '*', '/', '^'];
  }

  function getOperandRangeForRound(round) {
    // Early: small/whole. Later: include floats and bigger numbers.
    if (round <= 7) return { min: 1, max: 12, float: false };
    if (round <= 15) return { min: 2, max: 30, float: true };
    return { min: 3, max: 60, float: true };
  }

  // Helper: Generate a random float or int
  function randomOperand(min, max, asFloat = false) {
    if (asFloat && Math.random() < 0.5) {
      // 50% chance of float
      return +(Math.random() * (max - min) + min).toFixed(1);
    } else {
      return randomInt(min, max);
    }
  }

  function generateExpressionsForRound(round, count) {
    const ops = getOperatorSetForRound(round);
    const range = getOperandRangeForRound(round);
    const results = new Set();
    const items = [];
    let guard = 0;
    while (items.length < count && guard < 5000) {
      guard++;
      // Pick unique operators per question, rotate list
      const op = ops[items.length % ops.length];
      // Use floats in later rounds
      let a, b;
      if (op === '/' && range.float) {
        b = randomOperand(Math.max(0.5, range.min), Math.max(1, Math.min(15, range.max)), true);
        // To avoid div/0
        if (b === 0) b = 1;
        a = +(b * randomInt(2, Math.max(3, Math.floor(range.max / b)))).toFixed(1);
      } else if (op === '^') {
        // Power: base small, exp small to moderate
        a = randomOperand(range.min, Math.min(range.max, round < 10 ? 5 : 9), false);
        b = randomOperand(2, round < 10 ? 3 : (round < 20 ? 4 : 6), false);
      } else {
        a = randomOperand(range.min, range.max, op !== '^' && range.float);
        b = randomOperand(range.min, range.max, op !== '^' && range.float);
      }
      const value = evaluateAdvanced(a, b, op);
      if (!Number.isFinite(value)) continue;
      if (Math.abs(value) > 999999) continue;
      // Use rounded value as key to avoid floating roundtrip dupe
      const valKey = Math.round(+value * 1000) / 1000;
      if (results.has(valKey)) continue;
      results.add(valKey);
      // Format expression: floats show up to 1 decimal; powers with ^
      const exprStr =
        op === '^'
        ? `${a}^${b}`
        : `${a}${op}${b}`;
      items.push({ expr: exprStr, value });
    }
    return items;
  }

  // Evaluator supporting ^ and float-friendly
  function evaluateAdvanced(a, b, op) {
    switch (op) {
      case '+': return +(a + b).toFixed(2);
      case '-': return +(a - b).toFixed(2);
      case '*': return +(a * b).toFixed(2);
      case '/': return b === 0 ? Infinity : +(a / b).toFixed(2);
      case '^': return Math.pow(a, b);
      default: return NaN;
    }
  }

  function showOverlay(el) {
    el.classList.add('visible');
    el.setAttribute('aria-hidden', 'false');
  }

  function hideOverlay(el) {
    el.classList.remove('visible');
    el.setAttribute('aria-hidden', 'true');
  }

  // Fisher-Yates shuffle util
  function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
})();


