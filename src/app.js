(function () {
  const D = window.MORPH_DATA;
  const stageEl = document.getElementById('stage');
  const dialogEl = document.getElementById('specsDialog');
  const dialogBody = document.getElementById('specsBody');

  const state = {
    slide: 0,
    volume: 100000,
    openingPlayed: false,
    morphLoopIdx: 0,
    // Interactive toggles for optimization steps 1..7 (step 0 is immutable baseline)
    enabled: [true, true, true, true, true, true, true, true]
  };

  const FX = window.MORPH_FX;
  let openingTimers = [];
  let countRaf = null;
  let morphTimer = null;

  const chevronLeftSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
  const chevronRightSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
  const dotsSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';
  const closeSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  const checkSvg = '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5L6.5 12L13 4"/></svg>';

  function clearTimers() {
    openingTimers.forEach(clearTimeout);
    openingTimers = [];
    if (countRaf) {
      cancelAnimationFrame(countRaf);
      countRaf = null;
    }
    if (FX) FX.cancel();
    if (morphTimer) {
      clearInterval(morphTimer);
      morphTimer = null;
    }
  }

  function scaleFactor() {
    return state.volume / 100000;
  }

  function fmtUsd(val) {
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (abs >= 1000) return sign + '$' + Math.round(abs).toLocaleString('en-US');
    if (abs >= 10) return sign + '$' + abs.toFixed(0);
    return sign + '$' + abs.toFixed(2);
  }

  function esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // BlurReveal text entrance matching blur-reveal.tsx (blur 12px, y: 10px -> blur 0, y: 0)
  function blurRevealHtml(text, startDelayMs = 0, charStaggerMs = 18) {
    if (!text) return '';
    const words = String(text).split(' ');
    let charCount = 0;

    const wordsHtml = words.map((word, wordIdx) => {
      const chars = Array.from(word);
      const charsHtml = chars.map((ch) => {
        const delay = Math.round(startDelayMs + charCount * charStaggerMs);
        charCount++;
        return `<span class="blur-char" style="--cd:${delay}ms;">${esc(ch)}</span>`;
      }).join('');

      let spaceHtml = '';
      if (wordIdx < words.length - 1) {
        const spaceDelay = Math.round(startDelayMs + charCount * charStaggerMs);
        charCount++;
        spaceHtml = `<span class="blur-char" style="--cd:${spaceDelay}ms;">&nbsp;</span>`;
      }

      return `<span class="blur-word">${charsHtml}${spaceHtml}</span>`;
    }).join('');

    return `<span class="blur-reveal-wrap">${wordsHtml}</span>`;
  }

  function renderTokensHtml(tokens, bubbleIdx) {
    const chipsHtml = tokens.map((t, j) => {
      const cls = (bubbleIdx + j) % 5;
      return `<span class="tok-chip tok-${cls}">${esc(t)}</span>`;
    }).join('');
    return `<div class="tok-cloud">${chipsHtml}</div>`;
  }

  function getBubbleOpeningSchedule() {
    const bubbles = [];
    let curTime = 80;
    D.chatBubbles.forEach((b) => {
      const boxTime = curTime;
      const textTime = curTime + 180;
      const textDur = b.text.length * 12 + 160;
      curTime = textTime + textDur + 120;
      bubbles.push({ boxTime, textTime, endTime: curTime });
    });
    return { bubbles, allBoxesDoneTime: curTime };
  }

  function prepareTokenDelays(bubbleRowEl, chipStaggerMs = 75, linePauseMs = 180) {
    const chips = Array.from(bubbleRowEl.querySelectorAll('.tok-chip'));
    const lineMap = new Map();
    chips.forEach(chip => {
      const top = Math.round(chip.offsetTop);
      if (!lineMap.has(top)) lineMap.set(top, []);
      lineMap.get(top).push(chip);
    });

    let curDelay = 0;
    lineMap.forEach((lineChips) => {
      lineChips.forEach((chip) => {
        chip.style.setProperty('--td', `${curDelay}ms`);
        curDelay += chipStaggerMs;
      });
      curDelay += linePauseMs;
    });
    return curDelay;
  }

  // Coherent real-math ledger evaluation up to maxStepIdx (0..7)
  function evalPipeline(maxStepIdx) {
    const k = scaleFactor();
    const baseUsd100k = 1701;
    let inTok = 5340;
    let outTok = 1200;
    let inRate = 1.50;
    let outRate = 7.50;

    const stepCost = () => ((inTok * inRate + outTok * outRate) / 1_000_000) * 100000;
    let prevCost = baseUsd100k;
    const rows = [{ idx: 0, label: D.stages[0].short, delta100k: baseUsd100k, checked: true }];

    for (let i = 1; i <= maxStepIdx; i++) {
      const on = state.enabled[i];
      if (on) {
        if (i === 1) { inTok = 4105; outTok = 1100; }
        else if (i === 2) { inTok += 1637; outTok = Math.min(outTok, 900); }
        else if (i === 3) { inTok = state.enabled[1] ? 3510 : 4100; outTok = Math.min(outTok, 900); }
        else if (i === 4) { inTok = 603; outTok = Math.min(outTok, 900); }
        else if (i === 5) { outTok = Math.min(outTok, 276); }
        else if (i === 6) { outTok = 80; }
        else if (i === 7) {
          inRate = 0.30;
          outRate = 2.50;
          if (state.enabled[4]) inTok = 1059;
          if (state.enabled[6]) outTok = 61;
          else if (state.enabled[5]) outTok = 210;
        }
      }
      const nextCost = stepCost();
      const delta = on ? Math.round(nextCost - prevCost) : 0;
      prevCost = nextCost;
      rows.push({ idx: i, label: D.stages[i].short, delta100k: delta, checked: on });
    }

    return {
      rows,
      totalUsd: prevCost * k,
      netDeltaUsd: (prevCost - baseUsd100k) * k,
      inTok,
      outTok
    };
  }

  function triXY(tri) {
    // Minimal equilateral vertices inside 184x118: Quality (92, 22), Speed (32, 98), Cost (152, 98)
    const wSum = tri.q + tri.s + tri.c;
    return {
      x: (tri.q * 92 + tri.s * 32 + tri.c * 152) / wSum,
      y: (tri.q * 22 + tri.s * 98 + tri.c * 98) / wSum
    };
  }

  function updateTriangle(activeIdx) {
    const svg = document.getElementById('triSvg');
    if (!svg) return;
    const points = D.stages.slice(0, activeIdx + 1).map(st => triXY(st.triangle));
    const curPt = points[points.length - 1];
    const group = document.getElementById('triOnionGroup');
    if (group) {
      group.replaceChildren();
      points.slice(0, -1).forEach((pt, idx) => {
        const dist = points.length - 1 - idx;
        const opacity = Math.max(0.08, 0.34 - dist * 0.04);
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', pt.x.toFixed(1));
        c.setAttribute('cy', pt.y.toFixed(1));
        c.setAttribute('r', '3');
        c.setAttribute('fill', 'var(--ink)');
        c.setAttribute('opacity', opacity.toFixed(2));
        group.appendChild(c);
      });
    }
    const dot = document.getElementById('triActiveDot');
    if (dot) {
      dot.setAttribute('cx', curPt.x.toFixed(1));
      dot.setAttribute('cy', curPt.y.toFixed(1));
    }
  }

  function renderCalcListHtml() {
    const k = scaleFactor();
    const maxStep = Math.min(state.slide, 7);
    const calc = evalPipeline(maxStep);

    const rowsHtml = calc.rows.map((r) => {
      const isCur = r.idx === maxStep;
      const cls = isCur ? 'is-active' : 'is-past';
      const unchkCls = !r.checked ? 'is-unchecked' : '';
      const val = r.delta100k * k;

      let valHtml = '';
      if (r.idx === 0) {
        valHtml = `<span class="tabular">${fmtUsd(val)}</span>`;
      } else if (!r.checked) {
        valHtml = `<span class="tabular" style="color:var(--ink-secondary);">$0</span>`;
      } else if (val > 0) {
        valHtml = `<span class="calc-plus tabular">+${fmtUsd(val)}</span>`;
      } else {
        valHtml = `<span class="calc-minus tabular">${fmtUsd(val)}</span>`;
      }

      const leftPart = r.idx === 0
        ? `<span class="calc-step-name">${r.label}</span>`
        : `<button class="calc-check-btn" role="checkbox" aria-checked="${r.checked}" data-action="toggle-step" data-step="${r.idx}">
             <span class="calc-box ${r.checked ? 'is-checked' : ''}">${r.checked ? checkSvg : ''}</span>
             <span class="calc-step-name">${r.label}</span>
           </button>`;

      return `<div class="calc-row ${cls} ${unchkCls}">${leftPart}${valHtml}</div>`;
    }).join('');

    const deltaText = state.slide === 0
      ? 'Baseline'
      : `${calc.netDeltaUsd >= 0 ? '+' : ''}${fmtUsd(calc.netDeltaUsd)} vs base`;

    return `
      <div class="calc-heading">Monthly ledger (${(state.volume / 1000).toFixed(0)}k turns)</div>
      ${rowsHtml}
      <div class="calc-total-box">
        <div class="calc-total-line">
          <span style="font-size:15px;color:var(--ink-secondary);">Total</span>
          <span class="calc-total-val tabular" style="color:${calc.totalUsd <= 150 * k ? 'var(--savings)' : 'var(--ink)'};">${fmtUsd(calc.totalUsd)}/mo</span>
        </div>
        <div class="calc-net-delta tabular" style="color:${calc.netDeltaUsd < 0 ? 'var(--savings)' : 'var(--ink-secondary)'};">${deltaText}</div>
      </div>
    `;
  }

  function updateRightRail() {
    updateTriangle(state.slide);
    const listEl = document.getElementById('calcList');
    if (listEl) listEl.innerHTML = renderCalcListHtml();
  }

  function renderSlideContent(s) {
    if (s.id === 'raw_ru') {
      const played = state.openingPlayed;
      const sched = getBubbleOpeningSchedule();
      const bubblesHtml = D.chatBubbles.map((b, idx) => {
        const visCls = played ? 'is-visible' : '';
        const textFaded = played ? 'is-faded' : '';
        const tokActive = played ? 'is-active is-played' : '';
        const textDelay = played ? 0 : sched.bubbles[idx].textTime;

        return `
          <div class="bubble-row is-${b.side} ${visCls}" data-bubble="${idx}">
            <span class="bubble-speaker">${b.speaker}</span>
            <div class="bubble-pill">
              <div class="bubble-text-layer ${textFaded}" data-text-layer="${idx}">
                ${blurRevealHtml(b.text, textDelay, played ? 0 : 12)}
              </div>
              <div class="bubble-tokens-layer ${tokActive}" data-tokens-layer="${idx}">
                ${renderTokensHtml(b.tokens, idx)}
              </div>
            </div>
          </div>
        `;
      }).join('');

      return `<div class="chat-thread" id="chatThread">${bubblesHtml}</div>`;
    }

    if (s.id === 'json_pretty') {
      return `<pre class="spec-lines json-pre json-block-reveal" style="margin:0;white-space:pre;">${esc(s.compactJson)}</pre>`;
    }

    if (s.id === 'pxpipe_png') {
      return `
        <div class="slide-stack">
          <img class="pxpipe-img-large wipe-line" style="--d:320ms;" src="${s.imageSrc}" data-action="zoom-png" alt="pxpipe dense 1568x228 grayscale PNG export" />
          <div style="font-size:15.5px;color:var(--ink-secondary);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
            <span class="tabular">${blurRevealHtml('1568x228 PNG (560 img + 43 text tokens)', 560, 10)}</span>
            <button class="text-btn wipe-line" style="--d:780ms;color:var(--ink);" data-action="zoom-png">Inspect 1:1</button>
          </div>
        </div>
      `;
    }

    if (s.id === 'response_schema') {
      return `
        <div class="slide-stack">
          <div style="font-size:16px;font-weight:600;color:var(--savings);">${blurRevealHtml('Structured Output (38 answer tokens, zero prose wrapper)', 200, 10)}</div>
          <pre class="spec-lines json-pre json-block-reveal" style="margin:0;white-space:pre;">${esc(s.outputJsonPretty)}</pre>
        </div>
      `;
    }

    if (s.id === 'flash_lite') {
      return `
        <div class="slide-stack">
          <div class="speed-grid">
            ${s.speedCards.map((c, idx) => `
              <div class="speed-item wipe-line" style="--d:${320 + idx * 240}ms;">
                <div style="font-size:15px;color:var(--ink-secondary);margin-bottom:8px;">${blurRevealHtml(c.label, 360 + idx * 240, 10)}</div>
                <div style="font-size:21px;font-weight:600;" class="tabular">${c.ttft} TTFT / ${c.e2e} E2E</div>
                <div style="font-size:16px;font-weight:600;color:var(--savings);margin-top:8px;" class="tabular">${c.cost100k} (${c.note})</div>
              </div>
            `).join('')}
          </div>
          <div class="translucent-note">
            ${blurRevealHtml('LLM benchmarks measure TTFT (Time to First Token, perceived speed until streaming begins) separately from E2E Response Time (total completion latency)', 880, 8)}
          </div>
        </div>
      `;
    }

    if (s.isFinal) {
      const f = s.morphFrames[state.morphLoopIdx % s.morphFrames.length];
      return `<div id="morphCode" class="morph-code-stage">${FX.formatCleanForm(f.code, f.codeType)}</div>`;
    }

    const linesHtml = s.lines.map((ln, idx) =>
      `<div class="spec-line" style="--i:${idx};">${blurRevealHtml(ln, 240 + idx * 240, 10)}</div>`
    ).join('');
    return `<div class="spec-lines">${linesHtml}</div>`;
  }

  function getSlideTiming(s) {
    if (s.id === 'json_pretty' || s.id === 'response_schema') {
      return { readoutMs: 740, subMs: 1160 };
    }
    if (s.id === 'pxpipe_png') {
      return { readoutMs: 1020, subMs: 1440 };
    }
    if (s.id === 'flash_lite') {
      return { readoutMs: 1220, subMs: 1640 };
    }
    if (s.isFinal) {
      return { readoutMs: 1380, subMs: 1800 };
    }
    const lineCount = s.lines ? s.lines.length : 3;
    const lastLineEnd = 240 + (lineCount - 1) * 240 + 380;
    return { readoutMs: lastLineEnd, subMs: lastLineEnd + 420 };
  }

  function runSlideOneOpening() {
    clearTimers();
    const bubbles = D.chatBubbles;
    const k = scaleFactor();
    if (state.openingPlayed) {
      const tokLine = document.getElementById('tokCounterLine');
      if (tokLine) tokLine.textContent = '5,340 input + 1,200 think = $0.0170 / turn';
      const m1 = stageEl.querySelector('[data-math="1"]');
      if (m1) {
        m1.innerHTML = `100k turns / mo = ${fmtUsd(1701 * k)}/mo`;
        m1.classList.add('is-visible');
      }
      const subEl = document.getElementById('stageSub');
      if (subEl) {
        subEl.classList.remove('is-pending');
        subEl.classList.add('is-visible');
      }
      return;
    }

    const sched = getBubbleOpeningSchedule();

    // Step 1: Sequential box appearance (first chat box appears, then text on it; then second box, then text on it...)
    sched.bubbles.forEach((sc, idx) => {
      openingTimers.push(setTimeout(() => {
        const row = stageEl.querySelector(`[data-bubble="${idx}"]`);
        if (row) row.classList.add('is-visible');
      }, sc.boxTime));
    });

    // Step 2: Line-by-line tokenization starting after all chat boxes and texts are displayed
    const tokenBaseStart = sched.allBoxesDoneTime + 320;
    let curMorphTime = tokenBaseStart;

    bubbles.forEach((b, idx) => {
      const morphTime = curMorphTime;
      const row = stageEl.querySelector(`[data-bubble="${idx}"]`);
      const bubbleDur = (row ? prepareTokenDelays(row, 75, 180) : (b.tokens.length * 75 + 360)) + 260;
      curMorphTime += bubbleDur + 220;

      openingTimers.push(setTimeout(() => {
        const textLayer = stageEl.querySelector(`[data-text-layer="${idx}"]`);
        const tokLayer = stageEl.querySelector(`[data-tokens-layer="${idx}"]`);
        if (textLayer) textLayer.classList.add('is-faded');
        if (tokLayer) tokLayer.classList.add('is-active');
      }, morphTime));
    });

    // Step 3: Outside math cascade wipes in ONLY AFTER Bubble 3 finishes completely + pause
    const math0Start = curMorphTime + 200;

    openingTimers.push(setTimeout(() => {
      const m0 = stageEl.querySelector('[data-math="0"]');
      if (m0) m0.classList.add('is-visible');

      const tokLine = document.getElementById('tokCounterLine');
      const dur = 800;
      const tStart = performance.now();
      function tick(now) {
        const p = Math.min(1, (now - tStart) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        const curIn = Math.round(5340 * eased);
        const curOut = Math.round(1200 * eased);
        if (tokLine) {
          tokLine.textContent = `${curIn.toLocaleString('en-US')} input + ${curOut.toLocaleString('en-US')} think = $0.0170 / turn`;
        }
        if (p < 1) countRaf = requestAnimationFrame(tick);
      }
      countRaf = requestAnimationFrame(tick);
    }, math0Start));

    // Step 4: Math Line 1 appears ONLY after Line 0 counter finishes + pause
    const math1Start = math0Start + 1200;
    openingTimers.push(setTimeout(() => {
      const m1 = stageEl.querySelector('[data-math="1"]');
      if (m1) {
        m1.innerHTML = `100k turns / mo = ${fmtUsd(1701 * k)}/mo`;
        m1.classList.add('is-visible');
      }
    }, math1Start));

    // Step 5: Subtitle enters ONLY after Math Line 1 appears + pause (zero layout shift)
    const subStart = math1Start + 600;
    openingTimers.push(setTimeout(() => {
      const subEl = document.getElementById('stageSub');
      if (subEl) {
        subEl.classList.remove('is-pending');
        subEl.classList.add('is-visible');
      }
      state.openingPlayed = true;
    }, subStart));
  }

  function updateMorphView(prevIdx, animate) {
    const frames = D.stages[8].morphFrames;
    const curIdx = state.morphLoopIdx % frames.length;
    const f = frames[curIdx];
    const prevF = typeof prevIdx === 'number' ? frames[prevIdx % frames.length] : null;
    const codeEl = document.getElementById('morphCode');

    if (animate && prevF && codeEl) {
      FX.morphSlide9Step(codeEl, prevF, f);
    } else if (codeEl) {
      codeEl.innerHTML = FX.formatCleanForm(f.code, f.codeType);
    }

    const calcRows = stageEl.querySelectorAll('.calc-row');
    calcRows.forEach((r, i) => {
      r.style.background = (i === curIdx) ? 'var(--surface-tint)' : 'transparent';
    });
  }

  function startFinalMorphLoop() {
    clearTimers();
    updateMorphView(null, false);
    morphTimer = setInterval(() => {
      const prevIdx = state.morphLoopIdx;
      state.morphLoopIdx = (state.morphLoopIdx + 1) % D.stages[8].morphFrames.length;
      updateMorphView(prevIdx, true);
    }, 980);
  }

  function buildBelowHtml(s, k, curCalc) {
    if (s.isFinal) return '';
    if (s.id === 'raw_ru') {
      return `<div class="math-cascade" id="mathCascade">
        <div class="math-line tabular" data-math="0" id="tokCounterLine">0 input + 0 think = $0.0000 / turn</div>
        <div class="math-line math-total tabular" data-math="1">100k turns / mo = ${fmtUsd(1701 * k)}/mo</div>
      </div>`;
    }
    return `<div class="readout-strip">
      <span class="readout-val tabular">${curCalc.inTok.toLocaleString('en-US')} input</span>
      <span class="readout-val tabular" style="color:var(--ink-secondary);">${curCalc.outTok.toLocaleString('en-US')} out+think</span>
      <span class="readout-val tabular" style="color:${curCalc.totalUsd <= 150 * k ? 'var(--savings)' : 'var(--ink)'};">${fmtUsd(curCalc.totalUsd)}/mo</span>
      <span class="readout-val tabular" style="color:var(--ink-secondary);">${s.ttftLabel}</span>
    </div>`;
  }

  function ensureShell() {
    if (document.getElementById('morphBox')) return;
    stageEl.innerHTML = `
      <div class="morph-shell">
        <header class="morph-header">
          <button class="icon-btn" data-action="open-specs" aria-label="Technical parameters">${dotsSvg}</button>
        </header>
        <div class="morph-workspace">
          <div class="workspace-spacer" aria-hidden="true"></div>
          <div class="morph-stage-col">
            <h1 class="stage-title" id="stageTitle"></h1>
            <div class="morph-box box-fade" id="morphBox"></div>
            <div class="below-box-slot" id="belowBoxSlot"></div>
            <p class="stage-sub" id="stageSub"></p>
          </div>
          <aside id="railCol" class="rail-col" aria-label="Trade-off triangle and interactive monthly calculator">
            <div class="triangle-panel" aria-label="Quality Speed Cost balance">
              <svg id="triSvg" class="triangle-svg" viewBox="0 0 184 118">
                <polygon points="92,22 32,98 152,98" fill="none" stroke="currentColor" stroke-opacity="0.22" stroke-width="1" stroke-linejoin="round" />
                <text x="92" y="13" text-anchor="middle" class="triangle-label">Quality</text>
                <text x="24" y="114" text-anchor="middle" class="triangle-label">Speed</text>
                <text x="160" y="114" text-anchor="middle" class="triangle-label">Cost</text>
                <g id="triOnionGroup"></g>
                <circle id="triActiveDot" class="triangle-active-dot" cx="92" cy="22" r="4.5" fill="var(--savings)" />
              </svg>
            </div>
            <div id="calcList" class="calc-list"></div>
          </aside>
        </div>
        <footer class="morph-footer">
          <div class="footer-nav-cluster">
            <button class="icon-btn" id="btnPrev" data-action="prev-slide" aria-label="Previous slide">${chevronLeftSvg}</button>
            <div class="morph-dots" id="morphDots" role="tablist" aria-label="Slides">
              ${D.stages.map((st, idx) => `<button class="morph-dot" data-action="go-slide" data-idx="${idx}" data-current="false" aria-label="${st.title}"></button>`).join('')}
            </div>
            <button class="icon-btn" id="btnNext" data-action="next-slide" aria-label="Next slide">${chevronRightSvg}</button>
          </div>
        </footer>
      </div>
    `;
  }

  function updateFooterNav() {
    const prevBtn = document.getElementById('btnPrev');
    const nextBtn = document.getElementById('btnNext');
    if (prevBtn) prevBtn.disabled = state.slide === 0;
    if (nextBtn) nextBtn.disabled = state.slide === D.stages.length - 1;
    stageEl.querySelectorAll('.morph-dot').forEach((d, idx) => {
      d.dataset.current = String(idx === state.slide);
    });
  }

  function render(prevIdx, prevForm) {
    clearTimers();
    ensureShell();
    updateRightRail();
    updateFooterNav();

    const s = D.stages[state.slide];
    const k = scaleFactor();
    const curCalc = evalPipeline(Math.min(state.slide, 7));
    const titleEl = document.getElementById('stageTitle');
    const boxEl = document.getElementById('morphBox');
    const belowEl = document.getElementById('belowBoxSlot');
    const subEl = document.getElementById('stageSub');
    const isCompact = s.id === 'json_pretty';

    // Slide 9 keeps ONLY the pure transforming payload forms centered in the stage box
    titleEl.style.display = s.isFinal ? 'none' : '';
    belowEl.style.display = s.isFinal ? 'none' : '';
    subEl.style.display = s.isFinal ? 'none' : '';

    // Initial load on Slide 1 plays the full opening bubble -> BPE -> math -> subtitle reveal
    if (typeof prevIdx !== 'number') {
      boxEl.classList.remove('is-morphed');
      boxEl.classList.toggle('is-compact', isCompact);
      titleEl.innerHTML = blurRevealHtml(s.title, 0, 18);
      boxEl.innerHTML = renderSlideContent(s);
      belowEl.innerHTML = buildBelowHtml(s, k, curCalc);
      subEl.className = s.id === 'raw_ru' ? `stage-sub ${state.openingPlayed ? 'is-visible' : 'is-pending'}` : 'stage-sub';
      subEl.innerHTML = blurRevealHtml(s.subtitle, 0, 0);
      if (s.id === 'raw_ru') runSlideOneOpening();
      if (s.isFinal) startFinalMorphLoop();
      return;
    }

    // Slide-to-slide transition: 1) Form->Form morph -> 2) Title -> 3) Below readout + subtitle
    titleEl.classList.add('is-stage-hidden');
    belowEl.classList.add('is-stage-hidden');
    subEl.className = 'stage-sub is-stage-hidden';
    titleEl.textContent = s.title;
    belowEl.innerHTML = buildBelowHtml(s, k, curCalc);
    subEl.textContent = s.subtitle;

    const toForm = FX.extractSlideForm(s, D.chatBubbles, D.stages[8].morphFrames);
    const toHtml = renderSlideContent(s);
    const isWaste = s.id === 'json_pretty' || s.id === 'raw_ru';

    FX.morphBoxTransition(boxEl, prevForm, toForm, toHtml, isCompact, isWaste, () => {
      if (s.id === 'raw_ru') runSlideOneOpening();
      if (s.isFinal) {
        startFinalMorphLoop();
        return;
      }

      titleEl.classList.remove('is-stage-hidden');
      titleEl.innerHTML = blurRevealHtml(s.title, 0, 14);

      openingTimers.push(setTimeout(() => {
        belowEl.classList.remove('is-stage-hidden');
      }, 180));

      openingTimers.push(setTimeout(() => {
        subEl.classList.remove('is-stage-hidden');
        subEl.innerHTML = blurRevealHtml(s.subtitle, 0, 8);
      }, 360));
    });
  }

  function openSpecsModal(zoomOnly) {
    const s = D.stages[state.slide];
    if (zoomOnly) {
      dialogBody.innerHTML = `
        <div class="dialog-head">
          <h2 id="specsTitle" style="margin:0;font-size:20px;">pxpipe 1568x228 Grayscale PNG (1:1 Export)</h2>
          <button class="icon-btn" data-action="close-dialog" aria-label="Close">${closeSvg}</button>
        </div>
        <div style="overflow-x:auto;background:#ffffff;padding:12px;border-radius:12px;">
          <img src="assets/pxpipe_page_1.png" style="width:1568px;height:228px;display:block;" alt="Full 1:1 pxpipe PNG" />
        </div>
        <div class="translucent-note">Scroll horizontally above to read raw 1:1 rasterized JSON tokens inside the PNG</div>
      `;
    } else {
      dialogBody.innerHTML = `
        <div class="dialog-head">
          <h2 id="specsTitle" style="margin:0;font-size:20px;">${s.title}</h2>
          <button class="icon-btn" data-action="close-dialog" aria-label="Close">${closeSvg}</button>
        </div>
        <div>
          <div class="spec-kv-row"><span>Model</span><strong>${s.params.model}</strong></div>
          <div class="spec-kv-row"><span>Input tokens</span><strong class="tabular">${s.inputTokens.toLocaleString('en-US')}</strong></div>
          <div class="spec-kv-row"><span>Output + thinking</span><strong class="tabular">${s.outputTokens.toLocaleString('en-US')}</strong></div>
          <div class="spec-kv-row"><span>thinking_level</span><strong>${s.params.thinking_level}</strong></div>
          <div class="spec-kv-row"><span>media_resolution</span><strong>${s.params.media_resolution}</strong></div>
          <div class="spec-kv-row"><span>response_schema</span><strong>${s.params.response_schema}</strong></div>
          <div class="spec-kv-row"><span>Speed (TTFT / E2E)</span><strong>${s.ttftLabel} / ${s.e2eLabel}</strong></div>
          <div class="spec-kv-row"><span>Cache / Tier note</span><strong>${s.params.cache_discount}</strong></div>
        </div>
        <div class="translucent-note">
          Input counts measured via :countTokens; Flash-Lite TTFT and E2E measured via :streamGenerateContent SSE.
        </div>
      `;
    }
    dialogEl.showModal();
  }

  function goToSlide(idx) {
    const prevIdx = state.slide;
    if (prevIdx === idx) return;
    const prevStage = D.stages[prevIdx];
    let prevForm;
    if (prevStage && prevStage.isFinal) {
      const f = prevStage.morphFrames[state.morphLoopIdx % prevStage.morphFrames.length];
      prevForm = f.codeType === 'image' ? { type: 'image', src: f.code, text: '1568x228 PNG' } : { type: 'text', text: f.code };
    } else {
      prevForm = FX.extractSlideForm(prevStage, D.chatBubbles, D.stages[8].morphFrames);
    }
    state.slide = idx;
    if (D.stages[idx] && D.stages[idx].isFinal) state.morphLoopIdx = 0;
    render(prevIdx, prevForm);
  }

  stageEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const act = btn.dataset.action;
    if (act === 'next-slide' && state.slide < D.stages.length - 1) {
      goToSlide(state.slide + 1);
    } else if (act === 'prev-slide' && state.slide > 0) {
      goToSlide(state.slide - 1);
    } else if (act === 'go-slide') {
      goToSlide(parseInt(btn.dataset.idx, 10));
    } else if (act === 'toggle-step') {
      const idx = parseInt(btn.dataset.step, 10);
      state.enabled[idx] = !state.enabled[idx];
      updateRightRail();
      const s = D.stages[state.slide];
      const belowEl = document.getElementById('belowBoxSlot');
      if (belowEl && s.id !== 'raw_ru' && !s.isFinal) {
        belowEl.innerHTML = buildBelowHtml(s, scaleFactor(), evalPipeline(Math.min(state.slide, 7)));
      }
    } else if (act === 'open-specs') {
      openSpecsModal(false);
    } else if (act === 'zoom-png') {
      openSpecsModal(true);
    }
  });

  dialogEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="close-dialog"]') || e.target === dialogEl) {
      dialogEl.close();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowRight' && state.slide < D.stages.length - 1) {
      goToSlide(state.slide + 1);
    } else if (e.key === 'ArrowLeft' && state.slide > 0) {
      goToSlide(state.slide - 1);
    }
  });

  render();
})();
