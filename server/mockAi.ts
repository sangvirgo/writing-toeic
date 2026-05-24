import { AiFeedback, ChunkDifficulty, ChunkTopic, PracticeMode } from './types.js';

interface MockInput {
  mode: PracticeMode;
  prompt: string;
  userWriting: string;
}

function detectSimpleMistakes(userWriting: string): AiFeedback['mistakes'] {
  const mistakes: AiFeedback['mistakes'] = [];
  const text = userWriting.trim();

  // "want VERB" without "to"
  const wantMatch = text.match(/\bwant\s+(?!to\b)([a-z]+)/i);
  if (wantMatch) {
    const verb = wantMatch[1];
    mistakes.push({
      type: 'grammar',
      original: `want ${verb}`,
      correction: `want to ${verb}`,
      explanation: 'Use "want to + base verb" to talk about something you wish to do.',
    });
  }

  // missing capital at sentence start
  if (text.length > 0 && text[0] !== text[0].toUpperCase()) {
    mistakes.push({
      type: 'structure',
      original: text.slice(0, 20),
      correction: text[0].toUpperCase() + text.slice(1, 20),
      explanation: 'Begin each sentence with a capital letter.',
    });
  }

  // missing final period
  if (text.length > 0 && !/[.!?]$/.test(text)) {
    mistakes.push({
      type: 'structure',
      original: text.slice(-20),
      correction: text.slice(-20) + '.',
      explanation: 'End sentences with a period (or "!" / "?").',
    });
  }

  // very basic article check: "schedule meeting" -> "schedule the meeting"
  if (/\b(schedule|reschedule|cancel|attend|join)\s+meeting\b/i.test(text)) {
    mistakes.push({
      type: 'grammar',
      original: 'meeting',
      correction: 'the meeting',
      explanation: 'Use "the" with a specific meeting that both speakers know about.',
    });
  }

  return mistakes;
}

function buildCorrectedVersion(userWriting: string): string {
  let s = userWriting.trim();
  s = s.replace(/\bwant\s+(?!to\b)([a-z]+)/gi, 'want to $1');
  s = s.replace(/\b(schedule|reschedule|cancel|attend|join)\s+meeting\b/gi, '$1 the meeting');
  if (s.length > 0) s = s[0].toUpperCase() + s.slice(1);
  if (s.length > 0 && !/[.!?]$/.test(s)) s = s + '.';
  return s;
}

function buildNaturalVersion(corrected: string, mode: PracticeMode): string {
  if (mode === 'toeic_chunk') {
    return corrected.replace(/\.$/, '') + ' — could you confirm whether that works for you?';
  }
  if (mode === 'mistake_review') {
    return corrected.replace(/\.$/, '') + ' — nice job applying the corrected pattern.';
  }
  if (mode === 'ielts_sentence') {
    return corrected.replace(/\.$/, '') + ', which is a common trend in modern society.';
  }
  if (mode === 'ielts_paragraph') {
    return corrected.replace(/\.$/, '') + ', and this trend is likely to continue in the future.';
  }
  return corrected.replace(/\.$/, '') + ', and I plan to keep building on it tomorrow.';
}

function scoreWriting(userWriting: string, mistakeCount: number) {
  const length = userWriting.trim().split(/\s+/).filter(Boolean).length;
  const base = Math.min(10, Math.max(3, Math.round(length / 4)));
  const penalty = Math.min(5, mistakeCount);
  const grammar = Math.max(1, base - penalty);
  const vocabulary = Math.max(1, base - Math.floor(penalty / 2));
  const naturalness = Math.max(1, base - Math.ceil(penalty / 2));
  return { grammar, vocabulary, naturalness };
}

export function generateMockFeedback(input: MockInput): AiFeedback {
  return mockAnalyze(input);
}

export function mockAnalyze(input: MockInput): AiFeedback {
  const { mode, prompt, userWriting } = input;
  const mistakes = detectSimpleMistakes(userWriting);
  const correctedVersion = buildCorrectedVersion(userWriting);
  const naturalVersion = buildNaturalVersion(correctedVersion, mode);
  const score = scoreWriting(userWriting, mistakes.length);

  const usefulPatterns =
    mode === 'toeic_chunk'
      ? [
          {
            pattern: `Would it be possible to ${prompt}?`,
            example: `Would it be possible to ${prompt} next Tuesday?`,
          },
          {
            pattern: `I would like to ${prompt}.`,
            example: `I would like to ${prompt} as soon as possible.`,
          },
        ]
      : mode === 'mistake_review'
        ? [
            {
              pattern: 'Re-use the corrected pattern in a new context.',
              example: 'Try rewriting the same idea for a different colleague or situation.',
            },
            {
              pattern: 'Read the sentence out loud before sending it.',
              example: 'Reading it aloud helps you catch awkward word order.',
            },
          ]
        : mode === 'ielts_sentence'
          ? [
              {
                pattern: 'It is increasingly common for + noun + to + verb',
                example: 'It is increasingly common for students to study online.',
              },
              {
                pattern: 'One of the main reasons why + clause + is that + clause',
                example: 'One of the main reasons why tuition has risen is that costs keep increasing.',
              },
            ]
          : mode === 'ielts_paragraph'
            ? [
                {
                  pattern: 'Topic sentence: clearly state the main idea of the paragraph.',
                  example: 'One major advantage of remote work is the flexibility it offers employees.',
                },
                {
                  pattern: 'Linking: use "Furthermore" / "In addition" / "Moreover" to add points.',
                  example: 'Furthermore, employees can save money on commuting.',
                },
              ]
            : [
              {
                pattern: 'Today, I learned that ___.',
                example: 'Today, I learned that clear communication saves time.',
              },
              {
                pattern: 'One thing I want to improve tomorrow is ___.',
                example: 'One thing I want to improve tomorrow is my email tone.',
              },
            ];

  const ankiCards =
    mode === 'toeic_chunk'
      ? [
          { front: `(EN) ${prompt}`, back: `(VI) Practice writing 2–3 sentences using "${prompt}".` },
          { front: `Use in a sentence: ${prompt}`, back: correctedVersion },
        ]
      : mode === 'mistake_review'
        ? [
            { front: 'Practiced correction', back: correctedVersion },
            { front: 'Reminder', back: 'Apply the same pattern next time you see this mistake.' },
          ]
        : mode === 'ielts_sentence'
          ? [
              { front: 'IELTS sentence pattern', back: correctedVersion },
              { front: 'Academic phrase', back: 'It is increasingly common for + noun + to + verb' },
            ]
          : mode === 'ielts_paragraph'
            ? [
                { front: 'IELTS paragraph structure', back: 'Topic sentence → Explanation → Example → Result' },
                { front: 'Useful linking words', back: 'Furthermore, Moreover, In addition, Consequently' },
              ]
            : [
              { front: `Journal prompt: ${prompt}`, back: correctedVersion },
              { front: 'Natural rewrite', back: naturalVersion },
            ];

  const feedback: AiFeedback = {
    correctedVersion,
    naturalVersion,
    score,
    mistakes,
    usefulPatterns,
    ankiCards,
  };

  if (mode === 'ielts_paragraph') {
    feedback.ielts = {
      estimatedBand: 6.0,
      taskResponse: 6,
      coherenceCohesion: 6,
      lexicalResource: 6,
      grammaticalRangeAccuracy: 6,
      mainAdvice: [
        'Add a clearer topic sentence.',
        'Include a specific example to support your point.',
        'Use more linking words for better coherence.',
      ],
    };
  }

  return feedback;
}

interface MockChunkInput {
  topic: ChunkTopic;
  difficulty: ChunkDifficulty;
  count: number;
}

interface MockChunkOutput {
  text: string;
  meaningVi: string;
  topic: ChunkTopic;
  difficulty: ChunkDifficulty;
  example: string;
  tags: string[];
}

const MOCK_CHUNK_BANK: Record<ChunkTopic, { text: string; meaningVi: string; example: string; tags: string[] }[]> = {
  meeting: [
    { text: 'set up a meeting', meaningVi: 'sắp xếp một cuộc họp', example: 'Could you set up a meeting with the design team for tomorrow?', tags: ['meeting', 'scheduling'] },
    { text: 'circle back on', meaningVi: 'quay lại bàn về', example: "Let's circle back on the pricing question next week.", tags: ['meeting', 'follow-up'] },
    { text: 'walk through the slides', meaningVi: 'trình bày các slide', example: 'I will walk through the slides at the start of the call.', tags: ['meeting', 'presentation'] },
    { text: 'take the minutes', meaningVi: 'ghi biên bản', example: 'Linh agreed to take the minutes for this meeting.', tags: ['meeting', 'notes'] },
    { text: 'reschedule the call', meaningVi: 'dời lại cuộc gọi', example: 'Can we reschedule the call to Thursday afternoon?', tags: ['meeting', 'scheduling'] },
  ],
  office: [
    { text: 'submit a report', meaningVi: 'nộp báo cáo', example: 'Please submit the report before end of day.', tags: ['office', 'documents'] },
    { text: 'cc someone on an email', meaningVi: 'gửi CC ai đó trong email', example: 'Please cc my manager on the next update.', tags: ['office', 'email'] },
    { text: 'work from home', meaningVi: 'làm việc tại nhà', example: 'I will work from home on Friday.', tags: ['office', 'remote'] },
    { text: 'fill in the form', meaningVi: 'điền vào biểu mẫu', example: 'Could you fill in the form before lunch?', tags: ['office', 'paperwork'] },
    { text: 'book a meeting room', meaningVi: 'đặt phòng họp', example: 'I booked a meeting room on the 4th floor.', tags: ['office', 'logistics'] },
  ],
  travel: [
    { text: 'check in at the hotel', meaningVi: 'làm thủ tục nhận phòng', example: 'We can check in at the hotel after 2 p.m.', tags: ['travel', 'hotel'] },
    { text: 'book a flight', meaningVi: 'đặt vé máy bay', example: 'I booked a flight to Singapore for the workshop.', tags: ['travel', 'flight'] },
    { text: 'go on a business trip', meaningVi: 'đi công tác', example: 'My boss is going on a business trip next Monday.', tags: ['travel', 'business'] },
    { text: 'pick someone up at the airport', meaningVi: 'đón ai đó ở sân bay', example: 'I will pick the client up at the airport at 8 p.m.', tags: ['travel', 'logistics'] },
    { text: 'file an expense report', meaningVi: 'làm báo cáo chi phí', example: 'Remember to file your expense report after the trip.', tags: ['travel', 'finance'] },
  ],
  customer_service: [
    { text: 'follow up with a customer', meaningVi: 'theo sát khách hàng', example: 'I will follow up with the customer this afternoon.', tags: ['support', 'follow-up'] },
    { text: 'handle a complaint', meaningVi: 'xử lý khiếu nại', example: 'She knows how to handle a complaint calmly.', tags: ['support', 'complaint'] },
    { text: 'process a refund', meaningVi: 'xử lý hoàn tiền', example: 'We can process a refund within three business days.', tags: ['support', 'billing'] },
    { text: 'escalate the issue', meaningVi: 'đẩy vấn đề lên cấp trên', example: 'If you cannot solve it, please escalate the issue to me.', tags: ['support', 'escalation'] },
    { text: 'apologize for the inconvenience', meaningVi: 'xin lỗi vì sự bất tiện', example: 'We apologize for the inconvenience and will fix it today.', tags: ['support', 'tone'] },
  ],
  shopping: [
    { text: 'place an order', meaningVi: 'đặt đơn hàng', example: 'I placed an order for the new headphones last night.', tags: ['shopping', 'order'] },
    { text: 'out of stock', meaningVi: 'hết hàng', example: 'That model is out of stock until next week.', tags: ['shopping', 'inventory'] },
    { text: 'return a product', meaningVi: 'trả lại sản phẩm', example: 'Can I return this product if it does not fit?', tags: ['shopping', 'returns'] },
    { text: 'apply a discount code', meaningVi: 'áp mã giảm giá', example: 'Apply the discount code at checkout to save 10%.', tags: ['shopping', 'discount'] },
    { text: 'track the shipment', meaningVi: 'theo dõi đơn hàng', example: 'You can track the shipment with this link.', tags: ['shopping', 'delivery'] },
  ],
  hr: [
    { text: 'take a day off', meaningVi: 'xin nghỉ một ngày', example: 'I would like to take a day off on Friday.', tags: ['hr', 'leave'] },
    { text: 'hand in a resignation', meaningVi: 'nộp đơn xin nghỉ việc', example: 'He plans to hand in his resignation next month.', tags: ['hr', 'resignation'] },
    { text: 'go through onboarding', meaningVi: 'làm quy trình hội nhập', example: 'New hires go through onboarding in the first week.', tags: ['hr', 'onboarding'] },
    { text: 'apply for a position', meaningVi: 'ứng tuyển vào vị trí', example: 'I applied for a position in the marketing team.', tags: ['hr', 'hiring'] },
    { text: 'set up a one-on-one', meaningVi: 'lên lịch họp 1-1', example: 'Can we set up a one-on-one this week?', tags: ['hr', 'meeting'] },
  ],
  finance: [
    { text: 'cut costs', meaningVi: 'cắt giảm chi phí', example: 'We need to cut costs without hurting quality.', tags: ['finance', 'budget'] },
    { text: 'approve the budget', meaningVi: 'duyệt ngân sách', example: 'The director approved the budget yesterday.', tags: ['finance', 'budget'] },
    { text: 'send an invoice', meaningVi: 'gửi hóa đơn', example: 'I will send the invoice by Friday.', tags: ['finance', 'billing'] },
    { text: 'review the forecast', meaningVi: 'xem lại dự báo', example: 'Let me review the forecast before the call.', tags: ['finance', 'planning'] },
    { text: 'process the payment', meaningVi: 'xử lý thanh toán', example: 'Our team will process the payment this afternoon.', tags: ['finance', 'billing'] },
  ],
  business: [
    { text: 'close the deal', meaningVi: 'chốt thương vụ', example: 'We expect to close the deal by next quarter.', tags: ['business', 'sales'] },
    { text: 'meet the deadline', meaningVi: 'kịp hạn chót', example: "We can still meet the deadline if we focus this week.", tags: ['business', 'planning'] },
    { text: 'launch a new product', meaningVi: 'ra mắt sản phẩm mới', example: 'We will launch a new product in March.', tags: ['business', 'product'] },
    { text: 'expand into a new market', meaningVi: 'mở rộng sang thị trường mới', example: 'The team plans to expand into a new market next year.', tags: ['business', 'growth'] },
    { text: 'reach an agreement', meaningVi: 'đạt được thỏa thuận', example: 'Both sides finally reached an agreement.', tags: ['business', 'negotiation'] },
  ],
  general: [
    { text: 'get back to you', meaningVi: 'sẽ phản hồi lại bạn', example: "I'll get back to you by tomorrow morning.", tags: ['general', 'follow-up'] },
    { text: 'on the same page', meaningVi: 'thống nhất ý kiến', example: "Let's make sure we are on the same page before we start.", tags: ['general', 'alignment'] },
    { text: 'keep someone in the loop', meaningVi: 'giữ ai đó được cập nhật', example: 'Please keep me in the loop on this project.', tags: ['general', 'comm'] },
    { text: 'reach out to', meaningVi: 'liên hệ với', example: "Feel free to reach out to me if you have any questions.", tags: ['general', 'comm'] },
    { text: 'take a look at', meaningVi: 'xem qua', example: 'Could you take a look at the draft when you have time?', tags: ['general', 'review'] },
  ],
};

const DIFFICULTY_HINT: Record<ChunkDifficulty, string> = {
  easy: '(easy)',
  medium: '(medium)',
  hard: '(advanced)',
};

export function generateMockChunks(input: MockChunkInput): MockChunkOutput[] {
  const bank = MOCK_CHUNK_BANK[input.topic] ?? [];
  const out: MockChunkOutput[] = [];
  const used = new Set<string>();
  let i = 0;
  while (out.length < input.count && i < bank.length * 4) {
    const base = bank[i % bank.length];
    i++;
    if (!base) break;
    let text = base.text;
    if (used.has(text.toLowerCase())) {
      // Light variation so a single bank entry can still produce more results.
      text = `${base.text} ${DIFFICULTY_HINT[input.difficulty]}`;
      if (used.has(text.toLowerCase())) continue;
    }
    used.add(text.toLowerCase());
    out.push({
      text,
      meaningVi: base.meaningVi,
      topic: input.topic,
      difficulty: input.difficulty,
      example: base.example,
      tags: base.tags,
    });
  }
  return out;
}
