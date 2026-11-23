import fs from 'node:fs';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) throw new Error('Missing GEMINI_API_KEY');

const pngB64 = fs.readFileSync('assets/pxpipe_page_1.png').toString('base64');

const CFO_SCHEMA = {
  type: 'OBJECT',
  properties: {
    max_early_release_usd: { type: 'NUMBER' },
    l2_escalation_required: { type: 'BOOLEAN' },
    webhook_sla_credit_eligible: { type: 'BOOLEAN' },
    duplicate_zero_fee_refund: { type: 'BOOLEAN' }
  },
  required: ['max_early_release_usd', 'l2_escalation_required', 'webhook_sla_credit_eligible', 'duplicate_zero_fee_refund']
};

async function measureStream(model, label, body) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${API_KEY}`;
  const t0 = performance.now();
  let ttftMs = null;
  let fullText = '';
  let usage = {};

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errText = await res.text();
    return { model, label, ok: false, status: res.status, error: errText.slice(0, 240) };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === '[DONE]') continue;
      try {
        const chunk = JSON.parse(raw);
        if (chunk.usageMetadata) usage = chunk.usageMetadata;
        const parts = chunk.candidates?.[0]?.content?.parts || [];
        for (const p of parts) {
          if (p.text && !p.thought) {
            if (ttftMs === null) ttftMs = Math.round(performance.now() - t0);
            fullText += p.text;
          }
        }
      } catch {}
    }
  }
  const totalMs = Math.round(performance.now() - t0);
  if (ttftMs === null) ttftMs = totalMs;
  return {
    model,
    label,
    ok: true,
    ttftMs,
    totalMs,
    inputTokens: usage.promptTokenCount || 0,
    outputTokens: usage.candidatesTokenCount || 0,
    thoughtTokens: usage.thoughtsTokenCount || 0,
    answer: fullText
  };
}

// 1. Measure countTokens on gemini-3.5-flash-lite for pxpipe PNG
const ctRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:countTokens?key=${API_KEY}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{
      role: 'user',
      parts: [
        { text: 'Read image and return CFO JSON for events t=6.' },
        { inlineData: { mimeType: 'image/png', data: pngB64 } }
      ]
    }]
  })
});
const ctJson = await ctRes.json();
console.log('3.5-flash-lite countTokens:', JSON.stringify(ctJson));

// 2. Measure live streaming TTFT + E2E latency on gemini-3.5-flash-lite (with and without schema/thinking)
const flashLiteOptimized = await measureStream('gemini-3.5-flash-lite', 'flash_lite_pxpipe_schema', {
  contents: [{
    role: 'user',
    parts: [
      { text: 'Read the PayFlow account state PNG carefully and return the CFO JSON for events t=6.' },
      { inlineData: { mimeType: 'image/png', data: pngB64 } }
    ]
  }],
  generationConfig: {
    thinkingConfig: { thinkingBudget: 0 },
    responseMimeType: 'application/json',
    responseSchema: CFO_SCHEMA
  }
});
console.log('flashLiteOptimized:', JSON.stringify(flashLiteOptimized));

const flashLiteVerbose = await measureStream('gemini-3.5-flash-lite', 'flash_lite_high_prose', {
  contents: [{
    role: 'user',
    parts: [
      { text: 'Read the PayFlow account state PNG carefully and answer events t=6 in detail.' },
      { inlineData: { mimeType: 'image/png', data: pngB64 } }
    ]
  }],
  generationConfig: {
    thinkingConfig: { thinkingBudget: 1024 }
  }
});
console.log('flashLiteVerbose:', JSON.stringify(flashLiteVerbose));

// 3. Also test gemini-3.8-flash and gemini-4-hydrogen baseline timing (non-blocking if 503)
const benchRaw = JSON.parse(fs.readFileSync('data/benchmark.json', 'utf8'));
const hydrogenProbe = await measureStream('gemini-4-hydrogen', 'hydrogen_low_schema', {
  contents: [{
    role: 'user',
    parts: [
      { text: 'Read the PayFlow account state PNG carefully and return the CFO JSON for events t=6.' },
      { inlineData: { mimeType: 'image/png', data: pngB64 }, mediaResolution: { level: 'MEDIA_RESOLUTION_MEDIUM' } }
    ]
  }],
  generationConfig: {
    thinkingConfig: { thinkingLevel: 'LOW' },
    responseMimeType: 'application/json',
    responseSchema: CFO_SCHEMA
  }
});
console.log('hydrogenProbe:', JSON.stringify(hydrogenProbe));

benchRaw.flashLite = {
  countTokens: ctJson,
  optimizedRun: flashLiteOptimized,
  verboseRun: flashLiteVerbose,
  pricingPer1M: { inputUsd: 0.30, outputUsd: 2.50 }
};
benchRaw.hydrogenProbe = hydrogenProbe;
fs.writeFileSync('data/benchmark.json', JSON.stringify(benchRaw, null, 2), 'utf8');
console.log('Updated data/benchmark.json');
