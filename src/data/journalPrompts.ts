export const JOURNAL_PROMPTS: string[] = [
  'What did you learn today?',
  'What problem did you solve today?',
  'What did you do at work today?',
  'What is one thing you want to improve tomorrow?',
  'What mistake did you make today and what did you learn from it?',
  'What made you feel productive today?',
  'What was difficult today?',
];

export function randomPrompt(exclude?: string): string {
  if (JOURNAL_PROMPTS.length === 0) return '';
  let pick = JOURNAL_PROMPTS[Math.floor(Math.random() * JOURNAL_PROMPTS.length)];
  if (exclude && JOURNAL_PROMPTS.length > 1) {
    let guard = 0;
    while (pick === exclude && guard < 10) {
      pick = JOURNAL_PROMPTS[Math.floor(Math.random() * JOURNAL_PROMPTS.length)];
      guard++;
    }
  }
  return pick;
}
