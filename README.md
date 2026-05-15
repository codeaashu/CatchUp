# CatchUp
<<<<<<< HEAD
Too many messages. Catch every conversation in seconds.
=======

CatchUp is a Chrome extension that summarizes the open chat in web-based messengers like WhatsApp Web and Telegram Web.

## What it does

- Reads visible chat text from the active browser tab
- Sends the transcript to OpenAI for summarization
- Shows the summary inside the extension popup
- Works locally without a backend server

## Requirements

- Google Chrome or Chromium-based browser
- A chat open in WhatsApp Web, Telegram Web, or another web app where the message text is visible in the page DOM
- An OpenAI API key

## Build

Install dependencies and build the extension:

```bash
npm install
npm run build
```

The build writes the extension files into `dist/`.

## Load in Chrome

1. Open `chrome://extensions`
2. Turn on `Developer mode`
3. Click `Load unpacked`
4. Select the `dist/` folder

## Use

1. Open WhatsApp Web, Telegram Web, or another supported chat page
2. Click the CatchUp extension icon
3. Paste your OpenAI API key
4. Choose a model if you want to change the default `gpt-4o-mini`
5. Click `Summarize current tab`

## Notes

- The extension reads only the page that is currently open in the browser.
- If a page uses unusual DOM structure, you may need app-specific extraction rules later.
- The first version is intentionally backend-free to keep it free to run.

## Troubleshooting

- If the popup says no message text was found, make sure the chat thread is open and visible.
- If OpenAI returns an error, verify the API key and model name.
- If Chrome cannot load the extension, rebuild with `npm run build` and load the `dist/` folder again.
>>>>>>> 853a7a3 (first commit)
