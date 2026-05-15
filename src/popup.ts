type SummaryResponse =
  | {
      ok: true;
      summary: string;
      transcript: string;
      source: {
        app: string;
        title: string;
        url: string;
        messages: string[];
      };
    }
  | {
      ok: false;
      error: string;
    };

type ChromeSummaryResponse = SummaryResponse | undefined;

const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const modelInput = document.getElementById('model') as HTMLInputElement;
const saveButton = document.getElementById('saveSettings') as HTMLButtonElement;
const summarizeButton = document.getElementById('summarize') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLSpanElement;
const outputEl = document.getElementById('output') as HTMLPreElement;

function setStatus(text: string, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
}

function setOutput(text: string, isError = false) {
  outputEl.textContent = text;
  outputEl.classList.toggle('error', isError);
}

async function loadSettings() {
  const stored = await chrome.storage.local.get({
    openaiApiKey: '',
    model: 'gpt-4o-mini',
  });

  apiKeyInput.value = String(stored.openaiApiKey || '');
  modelInput.value = String(stored.model || 'gpt-4o-mini');
}

async function saveSettings() {
  const openaiApiKey = apiKeyInput.value.trim();
  const model = modelInput.value.trim() || 'gpt-4o-mini';

  await chrome.storage.local.set({ openaiApiKey, model });
  setStatus('Settings saved');
  setOutput('Saved. Open a chat page and click Summarize current tab.');
}

async function summarizeCurrentTab() {
  setStatus('Capturing chat...');
  setOutput('Reading the visible chat text from the current tab...');
  summarizeButton.disabled = true;
  saveButton.disabled = true;

  try {
    const response = (await chrome.runtime.sendMessage({ type: 'SUMMARIZE_ACTIVE_TAB' })) as ChromeSummaryResponse;

    if (!response) {
      throw new Error('No response from background worker.');
    }

    if (!response.ok) {
      throw new Error(response.error);
    }

    const source = response.source;
    setStatus(`Summarized ${source.app}`);
    setOutput(response.summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus('Error', true);
    setOutput(message, true);
  } finally {
    summarizeButton.disabled = false;
    saveButton.disabled = false;
  }
}

saveButton.addEventListener('click', () => {
  void saveSettings();
});

summarizeButton.addEventListener('click', () => {
  void summarizeCurrentTab();
});

void loadSettings();
