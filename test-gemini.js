const apiKey = process.env.GEMINI_API_KEY;
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`;
const request = {
  contents: [{ parts: [{ text: "a beautiful mountain" }] }],
  generationConfig: {
    responseModalities: ['IMAGE'],
  }
};
fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(request)
}).then(r => r.json()).then(console.log).catch(console.error);
