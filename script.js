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
      const expressions = generateExpressionsForRound(currentRound, count);
      targetOrder = expressions
        .map(x => x.value)
        .slice()
        .sort((a, b) => a - b);
      nextIndex = 0;
      acceptingInput = true;

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

    const value = parseInt(target.dataset.value || '', 10);
    const expected = targetOrder[nextIndex];

    if (value === expected) {
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
    // Gradual ramp: only + for 1-5, + and - for 6-10, + - * 11-18, then all
    if (round <= 5) return ['+'];
    if (round <= 10) return ['+', '-'];
    if (round <= 18) return ['+', '-', '*'];
    return ['+', '-', '*', '/'];
  }

  function getOperandRangeForRound(round) {
    // Increase operand magnitude and complexity with rounds
    if (round <= 5) return { min: 1, max: 12 };
    if (round <= 10) return { min: 3, max: 20 };
    if (round <= 18) return { min: 6, max: 40 };
    return { min: 10, max: 80 };
  }

  function generateExpressionsForRound(round, count) {
    const ops = getOperatorSetForRound(round);
    const range = getOperandRangeForRound(round);
    const results = new Set();
    const items = [];

    // Build an operator sequence that rotates through ops to ensure diversity
    const opSeq = Array.from({ length: count }, (_, i) => ops[i % ops.length]);

    let guard = 0;
    for (let i = 0; i < opSeq.length && guard < 5000; i++) {
      const op = opSeq[i];
      let attempts = 0;
      while (attempts < 500) {
        attempts++;
        guard++;
        let a = randomInt(range.min, range.max);
        let b = randomInt(range.min, range.max);

        // Keep multiplication results modest
        if (op === '*') {
          a = randomInt(range.min, Math.min(range.max, 12));
          b = randomInt(range.min, Math.min(range.max, 12));
        }

        // Clean integer division when using '/'
        if (op === '/') {
          b = randomInt(Math.max(1, range.min), Math.min(range.max, 12));
          if (b === 0) b = 1;
          const q = randomInt(1, Math.min(30, Math.floor(range.max / b)) || 1);
          a = b * q;
        }

        const value = evaluate(a, b, op);
        if (!Number.isFinite(value)) continue;
        if (Math.abs(value) > 999) continue;
        if (results.has(value)) continue;

        results.add(value);
        const expr = `${a} ${op} ${b}`;
        items.push({ expr, value });
        break;
      }
    }
    return items;
  }

  function evaluate(a, b, op) {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b === 0 ? Infinity : a / b;
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
})();


