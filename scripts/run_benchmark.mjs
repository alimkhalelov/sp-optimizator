import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('Missing GEMINI_API_KEY');
  process.exit(1);
}

const MODEL = 'gemini-4-hydrogen';
const BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`;

const POLICY_RU = `Регламент службы поддержки B2B-платформы PayFlow для корпоративных клиентов (редакция 4.2):
1. Возвраты и заморозка выплат: при превышении порога чарджбэков 1.2% за последние 14 дней система автоматически переводит расчетный счет мерчанта в статус Hold_Review на 72 часа. Если мерчант предоставляет подтвержденные трек-номера отгрузки по спорным заказам через API /v2/disputes/evidence, аналитик может разморозить до 85% суммы досрочно в течение 4 часов.
2. Нарушение SLA по вебхукам: при задержке доставки событий payout.settled более 180 секунд более чем для 5% транзакций за сутки клиент категории Enterprise имеет право на сервис-кредит в размере 10% от ежемесячной комиссии платформы (но не более 1500 USD), если инцидент не связан с таймаутом на стороне сервера получателя (HTTP 504 или разрыв TCP до 3000 мс).
3. Сверка инвойсов и двойное списание: если по одной и той же идемпотентности Idempotency-Key обнаружено две успешные авторизации с разницей менее 60 секунд, вторая транзакция подлежит автоматическому возврату без комиссии шлюза (0% fee), при условии что статус клиринга еще не перешел в Settled.
4. Эскалация на вторую линию (L2 Risk): обязательна при сумме спорного удержания свыше 12000 USD, наличии ошибки SIGN_MISMATCH_401 более 3 раз подряд, либо при упоминании досудебной претензии.`;

const CHAT_RU = [
  ['user', 'Добрый день! У нас с сегодняшнего утра зависла выплата по счету MERCH-88412 на сумму 18450 долларов, статус в кабинете горит как Hold_Review, хотя обычно деньги приходят в 09:00 по Москве.'],
  ['assistant', 'Здравствуйте! Проверил статус аккаунта MERCH-88412. Выплата на 18450 USD действительно временно приостановлена автоматическим правилом Hold_Review на 72 часа из-за скачка показателя чарджбэков до 1.45% за последние 14 дней.'],
  ['user', 'Понял, но это ошибка нашей новой витрины, мы уже отправили все товары курьерской службой СДЭК и Почтой России. Как нам ускорить разблокировку? Нам нужно платить поставщикам завтра утром.'],
  ['assistant', 'Вы можете загрузить подтвержденные трек-номера по спорным заказам через эндпоинт /v2/disputes/evidence. После верификации мы сможем досрочно разморозить до 85% суммы (около 15682.50 USD) в течение 4 часов.'],
  ['user', 'Мы попробовали отправить треки в эндпоинт, но наш бэкенд получает ошибку SIGN_MISMATCH_401 уже четвертый раз подряд, хотя ключ API не меняли с прошлого месяца.'],
  ['assistant', 'Вижу 4 подряд ошибки SIGN_MISMATCH_401 в логах шлюза. Похоже, в заголовке X-Signature не учитывается вложенный массив tracking_ids при канонической сортировке JSON перед HMAC-SHA256.'],
  ['user', 'Хорошо, разработчик сейчас поправит подпись. Но у нас вторая проблема: вчера с 14:00 до 19:00 вебхуки payout.settled приходили с задержкой 4-6 минут, примерно для 12% наших операций. Мы на тарифе Enterprise, платим 9500 USD комиссии в месяц. Положена ли компенсация?'],
  ['assistant', 'Проверил телеметрию доставки за вчерашние сутки: доля задержек свыше 180 секунд составила 11.8%. Однако по 7% из этих запросов ваш сервер отвечал HTTP 504 или закрывал соединение по таймауту 2500 мс, и только 4.8% задержек произошли на нашей очереди.'],
  ['user', 'То есть 4.8% это меньше порога 5% и кредит 10% не дадут? А если учитывать только чистые падения без наших 504?'],
  ['assistant', 'Да, по пункту 2 регламента для сервис-кредита 10% необходимо более 5% задержек по вине нашей инфраструктуры. Так как 4.8% ниже порога, автоматический сервис-кредит не начисляется, но я могу приложить детальную выгрузку логов для вашей команды.'],
  ['user', 'Окей, понятно. И третий вопрос по заказу ORD-99210 на 420 USD: клиент дважды нажал оплату, ушло два запроса с одним Idempotency-Key с интервалом 18 секунд, оба списались. Сейчас статус обеих транзакций все еще Authorized, в Settled не перешли. Вернете без комиссии?'],
  ['assistant', 'Да, интервал составил 18 секунд (менее 60 секунд), ключ идемпотентности совпал, а статус еще Authorized. Вторая транзакция будет отменена с полным возвратом без комиссии шлюза (0% fee).'],
  ['user', 'Отлично. Разработчик только что обновил канонизацию JSON, но говорит, что теперь прилетает 422 по формату даты в поле shipped_at. И еще руководство просит официальный ответ: если деньги не разморозят до завтра, мы будем вынуждены направить досудебную претензию.'],
  ['assistant', 'Зафиксировал. По полю shipped_at требуется формат ISO-8601 UTC (например 2026-11-21T10:30:00Z). Учитывая сумму удержания 18450 USD, 4 ошибки SIGN_MISMATCH_401 и упоминание досудебной претензии, кейс подлежит обязательной эскалации на L2 Risk.'],
  ['user', 'На какую сумму максимум мы можем рассчитывать при досрочной разморозке, нужно ли эскалировать на L2, положен ли нам сервис-кредит по вебхукам, и вернут ли комиссию за дубль ORD-99210? Ответь максимально четко по всем 4 пунктам для финансового директора.']
];

const POLICY_EN = `PayFlow B2B Platform Support Policy (v4.2):
1. Payout Holds & Refunds: If 14-day chargeback rate exceeds 1.2%, merchant account enters automatic 72h Hold_Review. Submitting verified tracking IDs via /v2/disputes/evidence allows early release of up to 85% within 4 hours.
2. Webhook SLA Credits: If payout.settled delivery lags >180s for >5% of daily transactions, Enterprise clients get a 10% monthly fee service credit (capped at $1,500), excluding merchant-side HTTP 504 or TCP drops <=3000ms.
3. Duplicate Charges: Two successful authorizations sharing an Idempotency-Key within <60s still in Authorized (not Settled) status qualify for automatic 0% fee void/refund on the duplicate.
4. L2 Risk Escalation: Mandatory when held amount >$12,000, SIGN_MISMATCH_401 occurs >3 consecutive times, or pre-litigation notice is mentioned.`;

const CHAT_EN = [
  ['user', 'Hello, payout on MERCH-88412 ($18,450) has been stuck in Hold_Review since this morning instead of settling at 09:00 MSK.'],
  ['assistant', 'Checked MERCH-88412. The $18,450 payout hit an automatic 72h Hold_Review because 14-day chargebacks rose to 1.45%.'],
  ['user', 'Our new storefront forgot tracking sync, orders already shipped via CDEK and Russian Post. How do we speed up release before supplier payments tomorrow?'],
  ['assistant', 'Submit verified tracking IDs via /v2/disputes/evidence. Once verified, we can release up to 85% (~$15,682.50) within 4 hours.'],
  ['user', 'Tried posting tracking IDs, getting SIGN_MISMATCH_401 four times in a row even though the API key has not changed.'],
  ['assistant', 'Confirmed 4x SIGN_MISMATCH_401 errors. Your HMAC-SHA256 canonical JSON likely omits the nested tracking_ids array in X-Signature.'],
  ['user', 'Dev is fixing the signature. Also yesterday 14:00-19:00 payout.settled webhooks delayed 4-6 min for ~12% of events. We are Enterprise ($9,500/mo fee). Do we get an SLA credit?'],
  ['assistant', 'Telemetry shows 11.8% total >180s delays, but 7% were merchant HTTP 504 / 2500ms timeouts; only 4.8% were our queue delays.'],
  ['user', 'So 4.8% is below the 5% bar and no 10% credit applies?'],
  ['assistant', 'Correct, clause 2 requires >5% platform-caused delays. At 4.8% no automatic credit triggers, though I can export detailed logs.'],
  ['user', 'Also order ORD-99210 ($420): customer double-clicked, two calls with same Idempotency-Key 18s apart, both still Authorized (not Settled). 0% fee refund?'],
  ['assistant', 'Yes, 18s gap (<60s), matching Idempotency-Key, still Authorized: duplicate voids automatically at 0% gateway fee.'],
  ['user', 'Dev fixed JSON canonicalization, now getting 422 on shipped_at date format. Management says if funds are not released by tomorrow we will send a pre-litigation claim.'],
  ['assistant', 'Noted. shipped_at expects ISO-8601 UTC (2026-11-21T10:30:00Z). Given $18,450 hold, 4x SIGN_MISMATCH_401, and pre-litigation notice, L2 Risk escalation is mandatory.'],
  ['user', 'Give the CFO a crisp 4-point answer: max early release USD, whether L2 escalation is required, webhook SLA credit eligibility, and duplicate fee refund status.']
];

// Add realistic per-merchant ticket/order ledger (80 disputed & settled entries) representing real accumulated B2B support context
const LEDGER_ROWS_RU = Array.from({ length: 60 }, (_, i) =>
  `Заказ #ORD-${88000 + i}: сумма ${180 + (i * 17) % 450} USD, статус ${i % 5 === 0 ? 'Disputed' : 'Shipped'}, служба доставки ${i % 2 === 0 ? 'СДЭК' : 'Почта России'}, трек-номер TRK-${910000 + i * 13}, задержка вебхука ${(i * 23) % 210} сек, код ответа получателя ${i % 7 === 0 ? 'HTTP 504' : 'HTTP 200'}.`
).join('\n');

const LEDGER_ROWS_EN = Array.from({ length: 60 }, (_, i) =>
  `Order #ORD-${88000 + i}: amount $${180 + (i * 17) % 450}, status ${i % 5 === 0 ? 'Disputed' : 'Shipped'}, carrier ${i % 2 === 0 ? 'CDEK' : 'RU_POST'}, tracking TRK-${910000 + i * 13}, webhook_lag ${(i * 23) % 210}s, merchant_http ${i % 7 === 0 ? '504' : '200'}.`
).join('\n');

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

const rawRuPrompt = `${POLICY_RU}\n\nИстория переписки:\n${CHAT_RU.map(([r, m]) => `${r === 'user' ? 'Клиент' : 'Поддержка'}: ${m}`).join('\n')}\n\nЛог спорных заказов:\n${LEDGER_ROWS_RU}`;
const enPrompt = `${POLICY_EN}\n\nChat history:\n${CHAT_EN.map(([r, m]) => `${r === 'user' ? 'User' : 'Support'}: ${m}`).join('\n')}\n\nOrder log:\n${LEDGER_ROWS_EN}`;
const prettyJsonPrompt = `Analyze account state and answer events t=6.\n${JSON.stringify(STRUCTURED_JSON_DATA, null, 2)}`;
const minJsonPrompt = `Analyze account state and answer events t=6.\n${JSON.stringify(STRUCTURED_JSON_DATA)}`;

// Expanded static enterprise prefix (>= 4500 tokens) to test real Gemini 4 Implicit Cache (-95%)
const EXTRA_POLICY_MATRIX = Array.from({ length: 110 }, (_, i) =>
  `RULE_${String(i + 200).padStart(3, '0')}|corridor=EMEA_CIS_${i % 5}|rail=SEPA_CARD_MIR|hold_h=${24 + (i % 4) * 12}|auto_rel=${i % 2 === 0}|kyb=${(i % 3) + 1}|cutoff=17:00Z|retry_ms=${1200 + i * 50}`
).join('\n');
const cachePrefixPrompt = `${enPrompt}\n\nEnterprise Settlement Matrix:\n${EXTRA_POLICY_MATRIX}`;

fs.mkdirSync('assets', { recursive: true });
fs.mkdirSync('data', { recursive: true });

console.log('Rendering pxpipe PNG...');
const pxOutMin = path.resolve('assets/px_min');
fs.rmSync(pxOutMin, { recursive: true, force: true });
const pxReportMin = execSync(`npx --yes pxpipe-proxy export --stdin --out "${pxOutMin}" --json`, {
  input: minJsonPrompt,
  encoding: 'utf8'
});
console.log('pxpipe report:', pxReportMin.trim());
const pxMinDir = fs.readdirSync(pxOutMin).find(d => d.startsWith('pxpipe-export-'));
const pxMinFiles = fs.readdirSync(path.join(pxOutMin, pxMinDir)).filter(f => f.endsWith('.png')).sort();
const pxMinPngPaths = pxMinFiles.map((f, idx) => {
  const dest = path.join('assets', `pxpipe_page_${idx + 1}.png`);
  fs.copyFileSync(path.join(pxOutMin, pxMinDir, f), dest);
  return dest;
});

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

async function callGemini(label, body) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const elapsedMs = Math.round(performance.now() - t0);
    const json = await res.json();
    if (!res.ok) {
      if ((res.status === 503 || res.status === 429) && attempt < 4) {
        console.warn(`Retry ${attempt} [${label}] after HTTP ${res.status}`);
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }
      console.error(`Error [${label}]:`, JSON.stringify(json));
      throw new Error(`API error on ${label}`);
    }
    const usage = json.usageMetadata || {};
    const text = json.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('') || '';
    const inputTokens = usage.promptTokenCount || 0;
    const cachedTokens = usage.cachedContentTokenCount || 0;
    const uncachedInput = Math.max(0, inputTokens - cachedTokens);
    const outputTokens = usage.candidatesTokenCount || 0;
    const thoughtTokens = usage.thoughtsTokenCount || 0;
    const billedOutput = outputTokens + thoughtTokens;
    const costUsd = (uncachedInput * 1.5 + cachedTokens * 0.075 + billedOutput * 7.5) / 1_000_000;
    console.log(`[${label}] in=${inputTokens} (cached=${cachedTokens}) out=${outputTokens} think=${thoughtTokens} ms=${elapsedMs} cost=$${costUsd.toFixed(6)}`);
    return {
      label,
      elapsedMs,
      inputTokens,
      cachedTokens,
      uncachedInput,
      outputTokens,
      thoughtTokens,
      billedOutput,
      costUsd,
      answerPreview: text.slice(0, 320),
      answerFull: text
    };
  }
}

const pxImageParts = (resolutionLevel) => pxMinPngPaths.map(p => ({
  inlineData: { mimeType: 'image/png', data: fs.readFileSync(p).toString('base64') },
  mediaResolution: { level: resolutionLevel }
}));

console.log('Calling gemini-4-hydrogen across stages (2 at a time)...');
const stageJobs = [
  ['01_raw_ru', {
    contents: [{ role: 'user', parts: [{ text: rawRuPrompt }] }],
    generationConfig: { thinkingConfig: { thinkingLevel: 'HIGH' } }
  }],
  ['02_english', {
    contents: [{ role: 'user', parts: [{ text: enPrompt }] }],
    generationConfig: { thinkingConfig: { thinkingLevel: 'HIGH' } }
  }],
  ['03_json_pretty', {
    contents: [{ role: 'user', parts: [{ text: prettyJsonPrompt }] }],
    generationConfig: { thinkingConfig: { thinkingLevel: 'HIGH' } }
  }],
  ['04_json_minified', {
    contents: [{ role: 'user', parts: [{ text: minJsonPrompt }] }],
    generationConfig: { thinkingConfig: { thinkingLevel: 'HIGH' } }
  }],
  ['05_pxpipe_medium', {
    contents: [{
      role: 'user',
      parts: [
        { text: 'Read the attached state document image(s) carefully and answer the final CFO summary request (events t=6) accurately.' },
        ...pxImageParts('MEDIA_RESOLUTION_MEDIUM')
      ]
    }],
    generationConfig: { thinkingConfig: { thinkingLevel: 'HIGH' } }
  }],
  ['06_optimized_after', {
    contents: [{
      role: 'user',
      parts: [
        { text: 'Read the image(s) and return CFO JSON for events t=6.' },
        ...pxImageParts('MEDIA_RESOLUTION_MEDIUM')
      ]
    }],
    generationConfig: {
      thinkingConfig: { thinkingLevel: 'LOW' },
      responseMimeType: 'application/json',
      responseSchema: CFO_SCHEMA
    }
  }]
];

const results = [];
for (let i = 0; i < stageJobs.length; i += 2) {
  const batch = stageJobs.slice(i, i + 2).map(([lbl, body]) => callGemini(lbl, body));
  results.push(...(await Promise.all(batch)));
}

// Sequential Implicit Cache test (>= 4096 prefix tokens)
const cacheWarm = await callGemini('07a_cache_miss_4k', {
  contents: [{
    role: 'user',
    parts: [
      { text: cachePrefixPrompt },
      { text: '\nFinal question: Return CFO JSON for MERCH-88412.' }
    ]
  }],
  generationConfig: {
    thinkingConfig: { thinkingLevel: 'LOW' },
    responseMimeType: 'application/json',
    responseSchema: CFO_SCHEMA
  }
});

await new Promise(r => setTimeout(r, 2000));

const cacheHit = await callGemini('07b_cache_hit_4k', {
  contents: [{
    role: 'user',
    parts: [
      { text: cachePrefixPrompt },
      { text: '\nFinal question: Confirm CFO JSON metrics for MERCH-88412 right now.' }
    ]
  }],
  generationConfig: {
    thinkingConfig: { thinkingLevel: 'LOW' },
    responseMimeType: 'application/json',
    responseSchema: CFO_SCHEMA
  }
});

const MONTHLY_REQUESTS = 100_000;
const beforeCost = results[0].costUsd;
const afterCost = results[5].costUsd;
const summary = {
  model: MODEL,
  measuredAt: new Date().toISOString(),
  pricingPer1M: { inputUsd: 1.50, cacheReadUsd: 0.075, outputAndThinkingUsd: 7.50 },
  scenario: {
    company: 'PayFlow B2B Support Copilot',
    monthlyRequests: MONTHLY_REQUESTS,
    rawRuChars: rawRuPrompt.length,
    enChars: enPrompt.length,
    prettyJsonChars: prettyJsonPrompt.length,
    minJsonChars: minJsonPrompt.length,
    pxpipePngPages: pxMinPngPaths
  },
  stages: results,
  cacheExperiment: { miss: cacheWarm, hit: cacheHit },
  monthly: {
    requests: MONTHLY_REQUESTS,
    beforeMonthlyUsd: +(beforeCost * MONTHLY_REQUESTS).toFixed(2),
    afterMonthlyUsd: +(afterCost * MONTHLY_REQUESTS).toFixed(2),
    savedMonthlyUsd: +((beforeCost - afterCost) * MONTHLY_REQUESTS).toFixed(2),
    costReductionPct: +(((beforeCost - afterCost) / beforeCost) * 100).toFixed(1),
    speedupFactor: +(results[0].elapsedMs / results[5].elapsedMs).toFixed(2),
    flexOrBatchMonthlyUsd: +((afterCost * 0.5) * MONTHLY_REQUESTS).toFixed(2)
  },
  artifacts: {
    rawRuSample: rawRuPrompt.slice(0, 820),
    enSample: enPrompt.slice(0, 820),
    prettyJsonSample: prettyJsonPrompt.slice(0, 820),
    minJsonSample: minJsonPrompt.slice(0, 820)
  }
};

fs.writeFileSync('data/benchmark.json', JSON.stringify(summary, null, 2), 'utf8');
console.log('SUMMARY MONTHLY:', JSON.stringify(summary.monthly));
