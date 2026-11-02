/**
 * NaviDdan NaviAI Service
 * Multi-provider AI assistant: Google Gemini, Groq, OpenAI, Ollama (Local)
 * Supports streaming, page summarization, translation, and text analysis
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

class NaviAIService {
  constructor(store) {
    this.store = store;
    this.activeAbortController = null;
  }

  getSettings() {
    const saved = this.store.get('aiSettings') || {};
    const defaults = {
      provider: 'gemini', // 'gemini' | 'groq' | 'openai' | 'ollama'
      model: 'gemini-1.5-flash',
      apiKeys: {
        gemini: '',
        groq: '',
        openai: ''
      },
      ollamaUrl: 'http://127.0.0.1:11434',
      systemPrompt: 'Tu es NaviAI, un assistant de navigation intelligent, rapide et précis intégré au navigateur cybernétique NaviDdan. Réponds en Markdown soigné et concis en français par défaut sauf indication contraire.',
      temperature: 0.7,
      isPanelOpen: false,
      panelWidth: 380
    };

    return {
      ...defaults,
      ...saved,
      apiKeys: {
        ...defaults.apiKeys,
        ...(saved.apiKeys || {})
      }
    };
  }

  saveSettings(newSettings) {
    const current = this.getSettings();
    const updated = { ...current, ...newSettings };
    this.store.set('aiSettings', updated);
    return updated;
  }

  stopCurrentStream() {
    if (this.activeAbortController) {
      try {
        this.activeAbortController.abort();
      } catch (e) {
        // ignore
      }
      this.activeAbortController = null;
    }
  }

  /**
   * Fetches installed Ollama models
   */
  async getOllamaModels(customUrl) {
    const settings = this.getSettings();
    const baseUrl = customUrl || settings.ollamaUrl || 'http://127.0.0.1:11434';
    const targetUrl = `${baseUrl.replace(/\/+$/, '')}/api/tags`;

    try {
      const response = await fetch(targetUrl, { signal: AbortSignal.timeout(3000) });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return (data.models || []).map(m => m.name);
    } catch (err) {
      return [];
    }
  }

  /**
   * Main streaming dispatcher
   * @param {Object} options { prompt, history, pageContext, provider, model }
   * @param {Function} onChunk (text) => void
   * @param {Function} onDone () => void
   * @param {Function} onError (err) => void
   */
  async streamChat(options, onChunk, onDone, onError) {
    this.stopCurrentStream();
    this.activeAbortController = new AbortController();
    const signal = this.activeAbortController.signal;

    const settings = this.getSettings();
    const provider = options.provider || settings.provider || 'gemini';
    const model = options.model || settings.model;
    const systemPrompt = settings.systemPrompt;
    const temperature = Number(settings.temperature) || 0.7;

    // Build context
    let fullPrompt = options.prompt;
    if (options.pageContext && options.pageContext.trim()) {
      fullPrompt = `[CONTEXTE DE LA PAGE WEB ACTIVE : "${options.pageTitle || 'Page web'}"]\nURL : ${options.pageUrl || 'Inconnue'}\nCONTENU :\n${options.pageContext}\n\n[DEMANDE UTILISATEUR] :\n${options.prompt}`;
    }

    try {
      switch (provider) {
        case 'gemini':
          await this._streamGemini({
            apiKey: settings.apiKeys.gemini,
            model: model || 'gemini-1.5-flash',
            systemPrompt,
            history: options.history || [],
            prompt: fullPrompt,
            temperature,
            signal,
            onChunk
          });
          break;

        case 'groq':
          await this._streamOpenAiCompatible({
            endpoint: 'https://api.groq.com/openai/v1/chat/completions',
            apiKey: settings.apiKeys.groq,
            model: model || 'llama-3.3-70b-versatile',
            systemPrompt,
            history: options.history || [],
            prompt: fullPrompt,
            temperature,
            signal,
            onChunk
          });
          break;

        case 'openai':
          await this._streamOpenAiCompatible({
            endpoint: 'https://api.openai.com/v1/chat/completions',
            apiKey: settings.apiKeys.openai,
            model: model || 'gpt-4o-mini',
            systemPrompt,
            history: options.history || [],
            prompt: fullPrompt,
            temperature,
            signal,
            onChunk
          });
          break;

        case 'ollama':
          await this._streamOllama({
            baseUrl: settings.ollamaUrl || 'http://127.0.0.1:11434',
            model: model || 'llama3',
            systemPrompt,
            history: options.history || [],
            prompt: fullPrompt,
            temperature,
            signal,
            onChunk
          });
          break;

        default:
          throw new Error(`Fournisseur non supporté : ${provider}`);
      }

      onDone();
    } catch (err) {
      if (signal.aborted) {
        onDone();
      } else {
        onError(err.message || String(err));
      }
    } finally {
      this.activeAbortController = null;
    }
  }

  // --- GOOGLE GEMINI STREAMING ---
  async _streamGemini({ apiKey, model, systemPrompt, history, prompt, temperature, signal, onChunk }) {
    if (!apiKey || !apiKey.trim()) {
      throw new Error("Clé API Google Gemini manquante. Renseigne-la dans les réglages NaviAI (⚙️).");
    }

    const cleanModel = model.replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:streamGenerateContent?key=${apiKey.trim()}&alt=sse`;

    // Convert history
    const contents = [];
    for (const h of history) {
      contents.push({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      });
    }
    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });

    const bodyPayload = {
      contents,
      systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      generationConfig: {
        temperature
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `Erreur Gemini (${response.status})`;
      try {
        const json = JSON.parse(errText);
        if (json.error && json.error.message) errMsg = json.error.message;
      } catch (e) {
        errMsg = errText || errMsg;
      }
      throw new Error(errMsg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep last incomplete line

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6);
          try {
            const data = JSON.parse(jsonStr);
            const candidates = data.candidates || [];
            if (candidates[0] && candidates[0].content && candidates[0].content.parts) {
              for (const part of candidates[0].content.parts) {
                if (part.text) {
                  onChunk(part.text);
                }
              }
            }
          } catch (e) {
            // parse error
          }
        }
      }
    }
  }

  // --- OPENAI-COMPATIBLE STREAMING (OpenAI & Groq) ---
  async _streamOpenAiCompatible({ endpoint, apiKey, model, systemPrompt, history, prompt, temperature, signal, onChunk }) {
    if (!apiKey || !apiKey.trim()) {
      throw new Error(`Clé API manquante pour ce fournisseur. Renseigne-la dans les réglages NaviAI (⚙️).`);
    }

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    for (const h of history) {
      messages.push({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        stream: true
      }),
      signal
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `Erreur API (${response.status})`;
      try {
        const json = JSON.parse(errText);
        if (json.error && json.error.message) errMsg = json.error.message;
      } catch (e) {
        errMsg = errText || errMsg;
      }
      throw new Error(errMsg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const payload = trimmed.slice(6);
          if (payload === '[DONE]') break;
          try {
            const data = JSON.parse(payload);
            const delta = data.choices && data.choices[0] && data.choices[0].delta;
            if (delta && delta.content) {
              onChunk(delta.content);
            }
          } catch (e) {
            // ignore
          }
        }
      }
    }
  }

  // --- OLLAMA STREAMING (Local) ---
  async _streamOllama({ baseUrl, model, systemPrompt, history, prompt, temperature, signal, onChunk }) {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const url = `${cleanBase}/api/chat`;

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    for (const h of history) {
      messages.push({ role: h.role, content: h.content });
    }
    messages.push({ role: 'user', content: prompt });

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          options: { temperature },
          stream: true
        }),
        signal
      });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      throw new Error(`Impossible de joindre Ollama sur ${cleanBase}. Assure-toi qu'Ollama est bien lancé ('ollama serve').`);
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erreur Ollama (${response.status}): ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const data = JSON.parse(trimmed);
          if (data.message && data.message.content) {
            onChunk(data.message.content);
          }
        } catch (e) {
          // ignore
        }
      }
    }
  }
}

module.exports = NaviAIService;
