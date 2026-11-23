// Juicy text-form metamorphosis engine for slide-to-slide transitions and Slide 09 fast loop
window.MORPH_FX = (function () {
  let codeRaf = null;
  let slideRaf = null;
  let stepTimer = null;

  function cancel() {
    if (codeRaf) { cancelAnimationFrame(codeRaf); codeRaf = null; }
    if (slideRaf) { cancelAnimationFrame(slideRaf); slideRaf = null; }
    if (stepTimer) { clearTimeout(stepTimer); stepTimer = null; }
  }

  function esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function formatCleanForm(code, codeType) {
    if (codeType === 'image') {
      return `<img class="morph-raster-img" src="${code}" alt="pxpipe 1568x228 PNG" />`;
    }
    return esc(code);
  }

  function extractSlideForm(s, chatBubbles, finalFrames) {
    if (!s) return { type: 'text', text: '' };
    if (s.id === 'raw_ru') {
      return { type: 'text', text: chatBubbles.map(b => `${b.speaker}: ${b.text}`).join('\n') };
    }
    if (s.id === 'json_pretty') return { type: 'text', text: s.compactJson };
    if (s.id === 'pxpipe_png') return { type: 'image', src: s.imageSrc, text: '1568x228 PNG (560 img + 43 text tokens)' };
    if (s.id === 'response_schema') return { type: 'text', text: s.outputJsonPretty };
    if (s.id === 'flash_lite') {
      return {
        type: 'text',
        text: s.speedCards.map(c => `${c.label}\n${c.ttft} TTFT / ${c.e2e} E2E\n${c.cost100k} (${c.note})`).join('\n')
      };
    }
    if (s.isFinal) {
      const f = finalFrames[0];
      return f.codeType === 'image' ? { type: 'image', src: f.code, text: '' } : { type: 'text', text: f.code };
    }
    return { type: 'text', text: (s.lines || []).join('\n') };
  }

  function runKineticText(el, fromText, toText, durMs, isWaste, onSettle) {
    const glyphs = '{}[]:"01~%$#';
    const t0 = performance.now();

    function tick(now) {
      const p = Math.min(1, (now - t0) / durMs);
      if (p >= 1) {
        onSettle();
        return;
      }
      const len = toText.length;
      const locked = Math.floor(p * (len + 6));
      let out = '';
      let hot = '';
      for (let i = 0; i < len; i++) {
        const ch = toText[i];
        if (ch === '\n' || ch === ' ') {
          if (hot) { out += `<span class="morph-glyph-hot ${isWaste ? 'is-waste' : ''}">${esc(hot)}</span>`; hot = ''; }
          out += ch;
        } else if (i < locked - 5) {
          if (hot) { out += `<span class="morph-glyph-hot ${isWaste ? 'is-waste' : ''}">${esc(hot)}</span>`; hot = ''; }
          out += esc(ch);
        } else if (i < locked) {
          const prevCh = i < fromText.length ? fromText[i] : '';
          hot += (prevCh && prevCh !== ch) ? glyphs[(i * 7 + Math.floor(p * 18)) % glyphs.length] : ch;
        } else if (i < fromText.length) {
          hot += fromText[i] === '\n' ? ' ' : fromText[i];
        }
      }
      if (hot) out += `<span class="morph-glyph-hot ${isWaste ? 'is-waste' : ''}">${esc(hot)}</span>`;
      el.innerHTML = out;
      slideRaf = requestAnimationFrame(tick);
    }
    slideRaf = requestAnimationFrame(tick);
  }

  function morphBoxTransition(boxEl, fromForm, toForm, toFinalHtml, isCompactTarget, isWaste, onDone) {
    cancel();
    const startH = boxEl.getBoundingClientRect().height;

    boxEl.classList.add('is-morphed');
    boxEl.classList.toggle('is-compact', isCompactTarget);
    boxEl.style.transition = 'none';
    boxEl.style.height = 'auto';
    boxEl.innerHTML = toFinalHtml;
    const targetH = Math.max(96, boxEl.getBoundingClientRect().height);

    boxEl.style.height = `${startH}px`;
    boxEl.style.overflow = 'hidden';
    boxEl.offsetHeight;
    boxEl.style.transition = 'max-width 380ms cubic-bezier(0.22, 1, 0.36, 1), height 380ms cubic-bezier(0.22, 1, 0.36, 1)';
    boxEl.style.height = `${targetH}px`;

    if (toForm.type === 'image') {
      boxEl.innerHTML = `<div class="morph-code-stage is-pulsing">${esc(fromForm.text || '')}</div>`;
      stepTimer = setTimeout(() => {
        boxEl.innerHTML = toFinalHtml;
        stepTimer = setTimeout(() => {
          boxEl.style.height = 'auto';
          boxEl.style.overflow = '';
          if (onDone) onDone();
        }, 320);
      }, 150);
      return;
    }

    const stageDiv = document.createElement('div');
    stageDiv.className = 'morph-code-stage is-pulsing';
    boxEl.innerHTML = '';
    boxEl.appendChild(stageDiv);

    const fromText = fromForm && fromForm.text ? fromForm.text : '';
    const toText = toForm.text || '';
    runKineticText(stageDiv, fromText, toText, 420, isWaste, () => {
      boxEl.innerHTML = toFinalHtml;
      boxEl.style.height = 'auto';
      boxEl.style.overflow = '';
      if (onDone) onDone();
    });
  }

  function morphSlide9Step(codeEl, prevF, nextF) {
    if (codeRaf) cancelAnimationFrame(codeRaf);
    const startH = codeEl.getBoundingClientRect().height;
    const targetHtml = formatCleanForm(nextF.code, nextF.codeType);

    codeEl.style.transition = 'none';
    codeEl.style.height = 'auto';
    codeEl.innerHTML = targetHtml;
    const targetH = Math.max(68, codeEl.getBoundingClientRect().height);

    codeEl.style.height = `${startH}px`;
    codeEl.offsetHeight;
    codeEl.style.transition = 'height 300ms cubic-bezier(0.22, 1, 0.36, 1)';
    codeEl.style.height = `${targetH}px`;

    if (nextF.codeType === 'image') {
      stepTimer = setTimeout(() => { codeEl.style.height = 'auto'; }, 320);
      return;
    }

    const fromText = prevF && prevF.codeType !== 'image' ? prevF.code : '';
    const toText = nextF.code;
    const glyphs = '{}[]:"01~%$#';
    const isWaste = nextF.tone === 'waste';
    const t0 = performance.now();
    const dur = 340;

    codeEl.classList.remove('is-pulsing');
    codeEl.offsetHeight;
    codeEl.classList.add('is-pulsing');

    function tick(now) {
      const p = Math.min(1, (now - t0) / dur);
      if (p >= 1) {
        codeEl.innerHTML = targetHtml;
        codeEl.style.height = 'auto';
        return;
      }
      const len = toText.length;
      const locked = Math.floor(p * (len + 6));
      let out = '';
      let hot = '';
      for (let i = 0; i < len; i++) {
        const ch = toText[i];
        if (ch === '\n' || ch === ' ') {
          if (hot) { out += `<span class="morph-glyph-hot ${isWaste ? 'is-waste' : ''}">${esc(hot)}</span>`; hot = ''; }
          out += ch;
        } else if (i < locked - 5) {
          if (hot) { out += `<span class="morph-glyph-hot ${isWaste ? 'is-waste' : ''}">${esc(hot)}</span>`; hot = ''; }
          out += esc(ch);
        } else if (i < locked) {
          const prevCh = i < fromText.length ? fromText[i] : '';
          hot += (prevCh && prevCh !== ch) ? glyphs[(i * 7 + Math.floor(p * 18)) % glyphs.length] : ch;
        } else if (i < fromText.length) {
          hot += fromText[i] === '\n' ? ' ' : fromText[i];
        }
      }
      if (hot) out += `<span class="morph-glyph-hot ${isWaste ? 'is-waste' : ''}">${esc(hot)}</span>`;
      codeEl.innerHTML = out;
      codeRaf = requestAnimationFrame(tick);
    }
    codeRaf = requestAnimationFrame(tick);
  }

  return { cancel, formatCleanForm, extractSlideForm, morphBoxTransition, morphSlide9Step };
})();
