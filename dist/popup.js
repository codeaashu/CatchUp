"use strict";
const apiKeyInput = document.getElementById('apiKey');
const modelInput = document.getElementById('model');
const saveButton = document.getElementById('saveSettings');
const summarizeButton = document.getElementById('summarize');
const statusEl = document.getElementById('status');
const outputEl = document.getElementById('output');
function setStatus(text, isError = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle('error', isError);
}
function setOutput(text, isError = false) {
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
        const response = (await chrome.runtime.sendMessage({ type: 'SUMMARIZE_ACTIVE_TAB' }));
        if (!response) {
            throw new Error('No response from background worker.');
        }
        if (!response.ok) {
            throw new Error(response.error);
        }
        const source = response.source;
        setStatus(`Summarized ${source.app}`);
        setOutput(response.summary);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus('Error', true);
        setOutput(message, true);
    }
    finally {
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
