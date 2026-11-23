import fs from 'node:fs';

const k = process.env.GEMINI_API_KEY;
const src = fs.readFileSync('scripts/measure_tokens.mjs', 'utf8');
// Reconstruct the exact PayFlow payloads cleanly
const LEDGER_JSON = Array.from({ length: 60 }, (_, i) => ({
  o: `ORD-${88000 + i}`,
  usd: 180 + (i * 17) % 450,
  st: i % 5 === 0 ? 'Disputed' : 'Shipped',
  c: i % 2 === 0 ? 'CDEK' : 'RU_POST',
  trk: `TRK-${910000 + i * 13}`,
  lag: (i * 23) % 210,
  http: i % 7 === 0 ? 504 : 200
}));

const STRUCTURED_JSON_DATA = {
  policy: {
    hold: { cb_gt: 0.012, d: 14, hold_h: 72, early_pct: 0.85, sla_h: 4, ep: '/v2/disputes/evidence' },
    sla: { lag_s: 180, min_pct: 0.05, credit_pct: 0.1, cap_usd: 1500, excl: ['HTTP_504', 'TCP<=3000ms'] },
    dup: { max_gap_s: 60, st: 'Authorized', fee: 0 },
    l2: { hold_gt: 12000, sign_err_gt: 3, pre_lit: true }
  },
  acct: { id: 'MERCH-88412', tier: 'Enterprise', fee_mo: 9500, hold_usd: 18450, cb_14d: 0.0145 },
  orders: LEDGER_JSON,
  events: [
    { t: 1, u: 'payout $18,450 stuck Hold_Review', a: '72h hold due 1.45% CB; early 85% ($15,682.50) in 4h via /v2/disputes/evidence' },
    { t: 2, u: '4x SIGN_MISMATCH_401 on upload', a: 'include nested tracking_ids in HMAC-SHA256 X-Signature' },
    { t: 3, u: '12% webhook >180s lag; SLA credit?', a: '7% merchant 504/2500ms, 4.8% platform (<5%); no credit' },
    { t: 4, u: 'ORD-99210 $420 double auth 18s Idempotency-Key Authorized', a: '0% fee auto-void eligible' },
    { t: 5, u: '422 shipped_at; pre-litigation claim tomorrow', a: 'ISO-8601 UTC; mandatory L2 Risk escalation' },
    { t: 6, u: 'CFO summary: 1) max early release USD, 2) L2 required?, 3) SLA credit?, 4) dup 0% fee?' }
  ]
};
const minJsonPrompt = `Analyze account state and answer events t=6.\n${JSON.stringify(STRUCTURED_JSON_DATA)}`;
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

async function streamRun(model, label, body) {
  const t0 = performance.now();
  let ttft = null;
  let txt = '';
  let u = {};
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${k}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) return { label, ok: false, status: r.status };
  const rd = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await rd.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const ls = buf.split('\n');
    buf = ls.pop() || '';
    for (const l of ls) {
      if (!l.startsWith('data: ')) continue;
      try {
        const j = JSON.parse(l.slice(6));
        if (j.usageMetadata) u = j.usageMetadata;
        for (const p of j.candidates?.[0]?.content?.parts || []) {
          if (p.text && !p.thought) {
            if (ttft === null) ttft = Math.round(performance.now() - t0);
            txt += p.text;
          }
        }
      } catch {}
    }
  }
  return { label, ok: true, ttftMs: ttft, totalMs: Math.round(performance.now() - t0), u, txt };
}

const rMin = await streamRun('gemini-3.5-flash-lite', 'flash_lite_min_json_low', {
  contents: [{ role: 'user', parts: [{ text: minJsonPrompt }] }],
  generationConfig: {
    thinkingConfig: { thinkingLevel: 'LOW' },
    responseMimeType: 'application/json',
    responseSchema: CFO_SCHEMA
  }
});
console.log('rMin:', JSON.stringify(rMin));
