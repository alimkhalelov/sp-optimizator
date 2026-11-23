// Verified live data from gemini-4-hydrogen:countTokens, pxpipe-proxy export, and gemini-3.5-flash-lite SSE
window.MORPH_DATA = {
  volumes: [10000, 100000, 500000, 1000000],
  chatBubbles: [
    {
      side: 'left',
      speaker: 'Client',
      text: 'У нас зависла выплата MERCH-88412 на 18 450 USD Hold _Review',
      tokens: ['У', ' нас', ' за', 'вис', 'ла', ' вы', 'пла', 'та', ' MERCH', '-88412', ' на', ' 18', ' 450', ' USD', ' Hold', '_Review']
    },
    {
      side: 'right',
      speaker: 'Support',
      text: 'Чарджбэки 1.45% . Загрузите треки /v2/disputes 85%',
      tokens: ['Чар', 'дж', 'бэ', 'ки', ' 1.45%', ' .', ' За', 'гру', 'зи', 'те', ' тре', 'ки', ' /v2', '/disputes', ' 85%']
    },
    {
      side: 'left',
      speaker: 'Client',
      text: 'Получаем SIGN _MISMATCH _401 и задержку 12% . ORD -99210?',
      tokens: ['По', 'лу', 'ча', 'ем', ' SIGN', '_MISMATCH', '_401', ' и', ' за', 'держ', 'ку', ' 12%', ' .', ' ORD', '-99210?']
    },
    {
      side: 'right',
      speaker: 'Support',
      text: 'Да: 4.8% по нашей вине, 0% дубль , эскалация L2',
      tokens: ['Да:', ' 4.8%', ' по', ' на', 'шей', ' ви', 'не,', ' 0%', ' дубль', ' ,', ' эс', 'ка', 'ла', 'ция', ' L2']
    }
  ],
  stages: [
    {
      id: 'raw_ru',
      step: '01',
      short: 'Raw RU Chat',
      title: 'Raw Russian Chat',
      subtitle: 'Cyrillic splits words into 3x tokens; high thinking adds $7.50/1M hidden output',
      model: 'gemini-4-hydrogen',
      inputTokens: 5340,
      outputTokens: 1200,
      inRate: 1.50,
      outRate: 7.50,
      monthlyDelta100k: 1701,
      runningMonthly100k: 1701,
      ttftLabel: '~16s+ TTFT',
      e2eLabel: '~22s total',
      triangle: { q: 0.90, s: 0.15, c: 0.10 },
      specNote: 'Unoptimized multi-turn Cyrillic dialogue + 60-order ledger + SLA rules',
      params: {
        model: 'gemini-4-hydrogen',
        thinking_level: 'high (default)',
        media_resolution: 'none',
        response_schema: 'false',
        cache_discount: '0% (no prefix lock)'
      }
    },
    {
      id: 'english',
      step: '02',
      short: 'English',
      title: 'English Normalization',
      subtitle: 'Translating the exact same PayFlow policy and 60-order ledger cuts 1,235 input tokens immediately',
      model: 'gemini-4-hydrogen',
      inputTokens: 4105,
      outputTokens: 1100,
      inRate: 1.50,
      outRate: 7.50,
      monthlyDelta100k: -260,
      runningMonthly100k: 1441,
      ttftLabel: '~15s TTFT',
      e2eLabel: '~20s total',
      triangle: { q: 0.90, s: 0.22, c: 0.24 },
      lines: [
        'PayFlow B2B Support Policy (v4.2): >1.2% CB triggers 72h Hold_Review',
        'User: Payout on MERCH-88412 ($18,450) stuck; 4x SIGN_MISMATCH_401',
        'Support: Submit tracking IDs via /v2/disputes/evidence for 85% release',
        'User: 12% webhook lag (7% 504, 4.8% queue); ORD-99210 $420 duplicate',
        'Ledger: 60 order rows attached in clean ASCII English (-23.1% input)'
      ],
      params: {
        model: 'gemini-4-hydrogen',
        thinking_level: 'high (default)',
        media_resolution: 'none',
        response_schema: 'false',
        cache_discount: '0%'
      }
    },
    {
      id: 'json_pretty',
      step: '03',
      short: 'Pretty JSON',
      title: 'Structured JSON Trap',
      subtitle: 'Typed keys remove prose fluff, yet indentation spaces and repeated keys inflate tokens to 5,742',
      model: 'gemini-4-hydrogen',
      inputTokens: 5742,
      outputTokens: 900,
      inRate: 1.50,
      outRate: 7.50,
      monthlyDelta100k: 95,
      runningMonthly100k: 1536,
      ttftLabel: '~14s TTFT',
      e2eLabel: '~18s total',
      triangle: { q: 0.92, s: 0.25, c: 0.16 },
      compactJson: `{
  "acct": {
    "id": "MERCH-88412",
    "hold_usd": 18450,
    "cb_14d": 0.0145
  },
  "orders": [
    {
      "o": "ORD-88000",
      "usd": 180,
      "st": "Disputed"
    }
  ]
}`,
      params: {
        model: 'gemini-4-hydrogen',
        thinking_level: 'high (default)',
        media_resolution: 'none',
        response_schema: 'false',
        cache_discount: '+1,637 whitespace tokens'
      }
    },
    {
      id: 'json_min',
      step: '04',
      short: 'Minified',
      title: 'Minified Zero-Newline',
      subtitle: 'Stripping whitespace and newlines eliminates 2,232 structural tokens in one deterministic pass',
      model: 'gemini-4-hydrogen',
      inputTokens: 3510,
      outputTokens: 900,
      inRate: 1.50,
      outRate: 7.50,
      monthlyDelta100k: -335,
      runningMonthly100k: 1201,
      ttftLabel: '~13s TTFT',
      e2eLabel: '~17s total',
      triangle: { q: 0.92, s: 0.34, c: 0.42 },
      lines: [
        '{"policy":{"hold":{"cb_gt":0.012,"d":14,"hold_h":72,"early_pct":0.85}},',
        '"acct":{"id":"MERCH-88412","tier":"Enterprise","hold_usd":18450},',
        '"orders":[{"o":"ORD-88000","usd":180,"st":"Disputed","http":504},...60],',
        '"events":[{"t":6,"u":"CFO summary: release, L2, SLA, dup 0% fee"}]}'
      ],
      params: {
        model: 'gemini-4-hydrogen',
        thinking_level: 'high (default)',
        media_resolution: 'none',
        response_schema: 'false',
        cache_discount: '-38.9% vs Pretty JSON'
      }
    },
    {
      id: 'pxpipe_png',
      step: '05',
      short: 'pxpipe PNG',
      title: 'pxpipe Vision Sheet',
      subtitle: '6,846 chars rasterized into 560 vision tokens (280 at low res)',
      model: 'gemini-4-hydrogen',
      inputTokens: 603,
      outputTokens: 900,
      inRate: 1.50,
      outRate: 7.50,
      monthlyDelta100k: -436,
      runningMonthly100k: 765,
      ttftLabel: '~12s TTFT',
      e2eLabel: '~16s total',
      triangle: { q: 0.84, s: 0.44, c: 0.62 },
      imageSrc: 'assets/pxpipe_page_1.png',
      params: {
        model: 'gemini-4-hydrogen',
        thinking_level: 'high (default)',
        media_resolution: 'medium (560 img tok)',
        response_schema: 'false',
        cache_discount: 'Needs >=4,096 tok for cache'
      }
    },
    {
      id: 'thinking_low',
      step: '06',
      short: 'Thinking Low',
      title: 'thinking_level: low',
      subtitle: 'Hidden reasoning tokens are billed at $7.50/1M (5x input). Cutting high to low eliminates ~918 thought tokens',
      model: 'gemini-4-hydrogen',
      inputTokens: 603,
      outputTokens: 276,
      inRate: 1.50,
      outRate: 7.50,
      monthlyDelta100k: -468,
      runningMonthly100k: 297,
      ttftLabel: '~1.6s TTFT',
      e2eLabel: '~2.9s total',
      triangle: { q: 0.82, s: 0.78, c: 0.78 },
      lines: [
        'thinking_level: high -> ~960 hidden tokens ($7.50/1M) + 16s silent TTFT',
        'thinking_level: low  -> ~36 hidden tokens ($7.50/1M) + ~1.6s first token',
        'Answer prose still verbose (~240 output tokens) until schema is locked'
      ],
      params: {
        model: 'gemini-4-hydrogen',
        thinking_level: 'low',
        media_resolution: 'medium (560)',
        response_schema: 'false',
        cache_discount: 'Output is 5x input price'
      }
    },
    {
      id: 'response_schema',
      step: '07',
      short: 'Schema JSON',
      title: 'Enforced responseSchema',
      subtitle: 'Locking output to a strict 4-key CFO JSON schema removes conversational filler and trims output to 80 tokens',
      model: 'gemini-4-hydrogen',
      inputTokens: 603,
      outputTokens: 80,
      inRate: 1.50,
      outRate: 7.50,
      monthlyDelta100k: -147,
      runningMonthly100k: 150,
      ttftLabel: '~1.4s TTFT',
      e2eLabel: '~1.6s total',
      triangle: { q: 0.88, s: 0.85, c: 0.86 },
      outputJsonPretty: `{
  "max_early_release_usd": 15682.5,
  "l2_escalation_required": true,
  "webhook_sla_credit_eligible": false,
  "duplicate_zero_fee_refund": true
}`,
      params: {
        model: 'gemini-4-hydrogen',
        thinking_level: 'low',
        media_resolution: 'medium (560)',
        response_schema: 'true (strict JSON)',
        cache_discount: 'Zero wrapper prose'
      }
    },
    {
      id: 'flash_lite',
      step: '08',
      short: 'Flash-Lite 3.5',
      title: 'Switch to gemini-3.5-flash-lite',
      subtitle: 'Routing tuned payloads to Flash-Lite ($0.30/1M in, $2.50/1M out) cuts bill another 69% at 1.36s TTFT',
      model: 'gemini-3.5-flash-lite',
      inputTokens: 1059,
      outputTokens: 61,
      inRate: 0.30,
      outRate: 2.50,
      monthlyDelta100k: -103,
      runningMonthly100k: 47,
      ttftLabel: '1.36s TTFT',
      e2eLabel: '1.44s E2E',
      triangle: { q: 0.86, s: 0.94, c: 0.96 },
      speedCards: [
        { label: 'PNG High + Low Think', ttft: '1.36s', e2e: '1.44s', cost100k: '$47/mo', note: '1,059 in + 61 out' },
        { label: 'Minified JSON + Low Think', ttft: '2.23s', e2e: '2.27s', cost100k: '$121/mo', note: '100% deterministic OCR-free' }
      ],
      params: {
        model: 'gemini-3.5-flash-lite',
        thinking_level: 'low (high-res PNG)',
        media_resolution: 'high (1,044 img tok)',
        response_schema: 'true (61 out tok)',
        cache_discount: '$23.50/mo on Flex/Batch'
      }
    },
    {
      id: 'final_morph',
      step: '09',
      short: 'Before / After',
      title: 'End-to-End Transformation',
      subtitle: 'PayFlow workload compressed from $1,701/mo to $47/mo with 11x faster TTFT',
      model: 'gemini-3.5-flash-lite',
      inputTokens: 1059,
      outputTokens: 61,
      inRate: 0.30,
      outRate: 2.50,
      monthlyDelta100k: 0,
      runningMonthly100k: 47,
      ttftLabel: '1.36s TTFT',
      e2eLabel: '1.44s E2E',
      triangle: { q: 0.90, s: 0.94, c: 0.96 },
      isFinal: true,
      morphFrames: [
        {
          tag: '01 Raw RU',
          deltaTag: 'Baseline',
          tone: 'waste',
          bill100k: 1701,
          inTokNum: 5340,
          outTokNum: 1200,
          speed: '~16s+ TTFT',
          codeType: 'text',
          code: 'Client: У нас зависла выплата MERCH-88412 на 18 450 USD Hold_Review\nSupport: Чарджбэки 1.45%. Загрузите треки /v2/disputes 85%'
        },
        {
          tag: '02 English',
          deltaTag: '-23% input',
          tone: 'savings',
          bill100k: 1441,
          inTokNum: 4105,
          outTokNum: 1100,
          speed: '~15s TTFT',
          codeType: 'text',
          code: 'User: Payout MERCH-88412 ($18,450) stuck Hold_Review; 4x SIGN_MISMATCH_401\nSupport: Submit tracking IDs /v2/disputes/evidence for 85% release'
        },
        {
          tag: '03 Pretty JSON',
          deltaTag: '+1,637 spaces',
          tone: 'waste',
          bill100k: 1536,
          inTokNum: 5742,
          outTokNum: 900,
          speed: '~14s TTFT',
          codeType: 'code',
          code: '{\n  "acct": { "id": "MERCH-88412", "hold_usd": 18450, "cb_14d": 0.0145 },\n  "orders": [{ "o": "ORD-88000", "usd": 180, "st": "Disputed" }]\n}'
        },
        {
          tag: '04 Minified',
          deltaTag: '-2,232 whitespace',
          tone: 'savings',
          bill100k: 1201,
          inTokNum: 3510,
          outTokNum: 900,
          speed: '~13s TTFT',
          codeType: 'code',
          code: '{"acct":{"id":"MERCH-88412","hold_usd":18450,"cb_14d":0.0145},"orders":[{"o":"ORD-88000","usd":180,"st":"Disputed"}]}'
        },
        {
          tag: '05 pxpipe PNG',
          deltaTag: '560 vision tok',
          tone: 'savings',
          bill100k: 765,
          inTokNum: 603,
          outTokNum: 900,
          speed: '~12s TTFT',
          codeType: 'image',
          code: 'assets/pxpipe_page_1.png'
        },
        {
          tag: '06 Think Low',
          deltaTag: '-918 think tok',
          tone: 'savings',
          bill100k: 297,
          inTokNum: 603,
          outTokNum: 276,
          speed: '~1.6s TTFT',
          codeType: 'code',
          code: 'config = { thinkingConfig: { thinkingLevel: "low" } } // 276 out+think'
        },
        {
          tag: '07 Schema',
          deltaTag: '-71% prose',
          tone: 'savings',
          bill100k: 150,
          inTokNum: 603,
          outTokNum: 80,
          speed: '~1.4s TTFT',
          codeType: 'code',
          code: '{"max_early_release_usd":15682.5,"l2_escalation_required":true}'
        },
        {
          tag: '08 Flash-Lite 3.5',
          deltaTag: '11x faster / -97% cost',
          tone: 'savings',
          bill100k: 47,
          inTokNum: 1059,
          outTokNum: 61,
          speed: '1.36s TTFT',
          codeType: 'code',
          code: '{"max_early_release_usd":15682.5,"l2_escalation_required":true,"webhook_sla_credit_eligible":false,"duplicate_zero_fee_refund":true}'
        }
      ],
      params: {
        model: 'gemini-3.5-flash-lite',
        thinking_level: 'low',
        media_resolution: 'high (1,044 img tok)',
        response_schema: 'true',
        cache_discount: '$23.50/mo on Flex/Batch'
      }
    }
  ]
};
