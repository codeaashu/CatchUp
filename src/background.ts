type CaptureResponse = {
  ok: true;
  data: {
    app: string;
    title: string;
    url: string;
    messages: string[];
  };
} | {
  ok: false;
  error: string;
};

type CapturedMessages = Extract<CaptureResponse, { ok: true }>['data'];

const DEFAULT_MODEL = 'gpt-4o-mini';

function summarizeLocally(transcript: string, source: { app: string; title: string; url: string; messages: string[] }): string {
  const lines = transcript
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  // Regex helpers
  const urlRe = /(https?:\/\/[^\s]+)/gi;
  const phoneRe = /(?:\+?\d[\d\s-]{6,}\d)/g;

  // Noise filters: roles, titles, company names, products that shouldn't be treated as people
  const noiseWords = new Set([
    'engineer', 'engineers', 'staff', 'hiring', 'role', 'position', 'developer', 'manager', 'director',
    'security', 'governance', 'lead', 'head', 'senior', 'junior', 'executive', 'hr', 'team', 'company',
    'workiva', 'azure', 'aws', 'google', 'microsoft', 'apple', 'amazon', 'oracle', 'salesforce',
    'exp', 'experience', 'yoe', 'years', 'key', 'mostly', 'required', 'skills', 'tech', 'technology',
    'backend', 'frontend', 'fullstack', 'qa', 'devops', 'infrastructure', 'platform', 'api', 'database',
  ]);

  const extractLinks = (text: string) => Array.from(text.matchAll(urlRe)).map(m => m[0]);
  const extractPhones = (text: string) => Array.from(text.matchAll(phoneRe)).map(m => m[0].trim());

  // Extract conversation topics
  const topicKeywords: { [key: string]: number } = {};
  const topicRe = /\b(job|position|opening|hiring|role|requirement|skill|experience|location|salary|compensation|interview|deadline|application|apply|interested|contact)\b/gi;
  const topicsInText = transcript.match(topicRe) || [];
  for (const topic of topicsInText) {
    topicKeywords[topic.toLowerCase()] = (topicKeywords[topic.toLowerCase()] || 0) + 1;
  }

  // Detect main discussion topic
  let mainTopic = 'General discussion';
  if (topicKeywords['job'] || topicKeywords['position'] || topicKeywords['role'] || topicKeywords['hiring']) {
    mainTopic = 'Job/Recruitment opportunity';
  } else if (topicKeywords['interview'] || topicKeywords['meeting']) {
    mainTopic = 'Interview or meeting arrangement';
  } else if (topicKeywords['apply'] || topicKeywords['application']) {
    mainTopic = 'Application/Submission details';
  }

  // Extract key context around topics
  const contextLines: string[] = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (
      lower.match(/job|position|role|opening|hiring/) ||
      lower.match(/company|organization|agency/) ||
      lower.match(/location|city|place/) ||
      lower.match(/salary|compensation|ctc|pay/) ||
      lower.match(/experience|skill|requirement/) ||
      lower.match(/deadline|apply|contact|interested/)
    ) {
      if (line.length > 10) {
        contextLines.push(line.length > 180 ? line.slice(0, 180) + '…' : line);
      }
    }
  }

  // Extract real people (multi-word proper nouns, filter out noise)
  const realPeople = new Set<string>();
  for (const line of lines) {
    const capNames = Array.from(line.matchAll(/\b([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*)\b/g)).map(m => m[1]);
    for (const name of capNames) {
      if (!noiseWords.has(name.toLowerCase()) && name.length > 3) {
        realPeople.add(name);
      }
    }
  }

  // Extract contacts
  const links = new Set(Array.from(new Set(lines.flatMap(extractLinks))));
  const phones = new Set(Array.from(new Set(lines.flatMap(extractPhones))));

  // Detect action items with better context
  const actions: string[] = [];
  const actionVerbsRe = /(apply|submit|send|contact|reach|call|email|message|connect|share|forward|fill|complete)/gi;
  for (const line of lines) {
    if (actionVerbsRe.test(line)) {
      const context = line.length > 160 ? line.slice(0, 160) + '…' : line;
      if (!actions.includes(context)) {
        actions.push(context);
      }
    }
  }

  // Build output
  const out: string[] = [];
  out.push(`🔍 Summary: ${mainTopic}`);
  out.push(`Chat: ${source.title} (${source.app})`);
  out.push('');

  // Context / Main points
  if (contextLines.length > 0) {
    out.push('Key details:');
    for (const ctx of contextLines.slice(0, 6)) {
      out.push(`  • ${ctx}`);
    }
    out.push('');
  }

  // Action items
  if (actions.length > 0) {
    out.push('📋 Next steps:');
    for (const action of actions.slice(0, 5)) {
      out.push(`  → ${action}`);
    }
    out.push('');
  }

  // People to contact
  if (realPeople.size > 0) {
    out.push('👤 Contacts:');
    for (const person of Array.from(realPeople).slice(0, 8)) {
      out.push(`  • ${person}`);
    }
    if (phones.size > 0) {
      out.push('');
      out.push('📞 Phone numbers:');
      for (const phone of Array.from(phones).slice(0, 5)) {
        out.push(`  • ${phone}`);
      }
    }
    out.push('');
  }

  // Links
  if (links.size > 0) {
    out.push('🔗 References:');
    for (const link of Array.from(links).slice(0, 4)) {
      const shortLink = link.length > 70 ? link.slice(0, 67) + '…' : link;
      out.push(`  • ${shortLink}`);
    }
    out.push('');
  }

  out.push('💡 Tip: Enable OpenAI API key in settings for AI-powered summaries.');

  return out.join('\n');
}

async function getSettings() {
  const stored = await chrome.storage.local.get({
    openaiApiKey: '',
    model: DEFAULT_MODEL,
  });

  return {
    openaiApiKey: String(stored.openaiApiKey || '').trim(),
    model: String(stored.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
  };
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];

  if (!tab?.id) {
    throw new Error('No active tab found.');
  }

  return tab;
}

function formatTranscript(messages: string[]): string {
  return messages
    .map((message, index) => `${index + 1}. ${message}`)
    .join('\n');
}

async function captureMessagesFromTab(tabId: number): Promise<CapturedMessages> {
  // Try sending the message; if there's no receiver, inject the content script and retry.
  return new Promise<CapturedMessages>((resolve, reject) => {
    const sendOnce = () => {
      chrome.tabs.sendMessage(tabId, { type: 'CAPTURE_MESSAGES' }, (resp: CaptureResponse) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!resp) {
          reject(new Error('No response from content script. Open a supported chat page and try again.'));
          return;
        }

        if (!resp.ok) {
          reject(new Error(resp.error));
          return;
        }

        resolve(resp.data);
      });
    };

    // First try
    chrome.tabs.sendMessage(tabId, { type: 'CAPTURE_MESSAGES' }, (resp: CaptureResponse) => {
      if (!chrome.runtime.lastError && resp) {
        if (!resp.ok) {
          reject(new Error(resp.error));
          return;
        }

        resolve(resp.data);
        return;
      }

      // No receiver — attempt to inject the content script and retry once
      try {
        chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }, () => {
          if (chrome.runtime.lastError) {
            console.error('Injection error:', chrome.runtime.lastError.message);
            reject(new Error('Failed to inject content script: ' + chrome.runtime.lastError.message));
            return;
          }

          console.log('Content script injected, retrying...');
          // give the script a short moment to initialize
          setTimeout(sendOnce, 300);
        });
      } catch (err) {
        console.error('Injection exception:', err);
        reject(new Error('Injection not permitted on this page or scripting API not available. Ensure you are on a standard web page (not chrome://, extension://, or file://).'));
      }
    });
  });
}

async function summarizeText(payload: {
  model: string;
  apiKey: string;
  title: string;
  app: string;
  url: string;
  transcript: string;
  source: { app: string; title: string; url: string; messages: string[] };
}): Promise<string> {
  if (!payload.apiKey) {
    return summarizeLocally(payload.transcript, payload.source);
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${payload.apiKey}`,
    },
    body: JSON.stringify({
      model: payload.model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You summarize chat transcripts clearly and concisely. Focus on decisions, action items, topics, questions, and unresolved items.',
        },
        {
          role: 'user',
          content: [
            `Summarize this chat transcript from ${payload.app}.`,
            `Page title: ${payload.title}`,
            `URL: ${payload.url}`,
            '',
            payload.transcript,
          ].join('\n'),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429 || errorText.includes('insufficient_quota')) {
      return summarizeLocally(payload.transcript, payload.source);
    }

    throw new Error(`OpenAI request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const summary = data.choices?.[0]?.message?.content?.trim();
  if (!summary) {
    throw new Error('OpenAI returned an empty summary.');
  }

  return summary;
}

chrome.runtime.onMessage.addListener((message: { type?: string }, _sender: chrome.runtime.MessageSender, sendResponse: (response: { ok: true; summary: string; transcript: string; source: CapturedMessages } | { ok: false; error: string }) => void) => {
  if (message?.type !== 'SUMMARIZE_ACTIVE_TAB') {
    return;
  }

  (async () => {
    try {
      const { openaiApiKey, model } = await getSettings();
      // Allow running with no OpenAI API key — fallback to local summarizer instead of failing.
      if (!openaiApiKey) {
        console.warn('No OpenAI API key saved; using local summarizer fallback.');
      }

      const tab = await getActiveTab();
      if (tab.id === undefined) {
        throw new Error('The active tab does not have a numeric id.');
      }

      const extracted = await captureMessagesFromTab(tab.id);
      if (!extracted.messages.length) {
        throw new Error('No message text was found on this page. Open the chat thread and try again.');
      }

      const transcript = formatTranscript(extracted.messages);
      const summary = await summarizeText({
        model,
        apiKey: openaiApiKey,
        title: extracted.title,
        app: extracted.app,
        url: extracted.url,
        transcript,
        source: extracted,
      });

      sendResponse({ ok: true, summary, transcript, source: extracted });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();

  return true;
});
