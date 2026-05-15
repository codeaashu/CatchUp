type ExtractionResult = {
  app: string;
  title: string;
  url: string;
  messages: string[];
};

const MAX_MESSAGES = 180;
const MAX_TEXT_LENGTH = 1200;

const APP_SELECTORS: Record<string, string[]> = {
  whatsapp: [
    '[data-testid*="msg-container"]',
    '[data-testid*="message-"]',
    'main [role="row"]',
    'main span[dir="auto"]',
  ],
  telegram: [
    '.message',
    '.Message',
    '[class*="message"]',
    '[class*="Message"]',
    'main article',
  ],
  generic: [
    'main [role="article"]',
    'main [role="listitem"]',
    'article',
    'li',
    '[role="article"]',
  ],
};

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

function isElementVisible(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
}

function collectCandidateText(selectors: string[]): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach((element) => {
      if (!isElementVisible(element)) {
        return;
      }

      const text = normalizeText(element.innerText || element.textContent || '');
      if (!text || text.length < 2 || text.length > MAX_TEXT_LENGTH) {
        return;
      }

      const key = text.toLowerCase();
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      results.push(text);
    });

    if (results.length >= MAX_MESSAGES) {
      break;
    }
  }

  return results.slice(0, MAX_MESSAGES);
}

function fallbackTranscript(): string[] {
  const bodyText = normalizeText(document.body.innerText || '');
  if (!bodyText) {
    return [];
  }

  const lines = bodyText
    .split('\n')
    .map((line) => normalizeText(line))
    .filter((line) => line.length > 0)
    .filter((line) => line.length < 300);

  const filtered: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    filtered.push(line);
    if (filtered.length >= MAX_MESSAGES) {
      break;
    }
  }

  return filtered;
}

function detectApp(): string {
  const host = location.hostname.toLowerCase();

  if (host.includes('whatsapp')) {
    return 'whatsapp';
  }

  if (host.includes('telegram')) {
    return 'telegram';
  }

  return 'generic';
}

function extractMessages(): ExtractionResult {
  const app = detectApp();
  const selectors = APP_SELECTORS[app] ?? APP_SELECTORS.generic;
  const textBlocks = collectCandidateText(selectors);
  const messages = textBlocks.length > 0 ? textBlocks : fallbackTranscript();

  return {
    app,
    title: document.title || 'Unknown page',
    url: location.href,
    messages,
  };
}

chrome.runtime.onMessage.addListener((message: { type?: string }, _sender: chrome.runtime.MessageSender, sendResponse: (response: { ok: true; data: ExtractionResult } | { ok: false; error: string }) => void) => {
  if (message?.type !== 'CAPTURE_MESSAGES') {
    return;
  }

  try {
    sendResponse({ ok: true, data: extractMessages() });
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return true;
});
