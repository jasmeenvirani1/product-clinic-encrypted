const OpenAI = require("openai");

// Build OpenAI client options. When a base URL is provided (for an
// OpenAI-compatible provider like MiniMax via https://ollama.com/v1),
// pass it as `baseURL`; otherwise the SDK defaults to api.openai.com.
const buildOpenAIOptions = (apiKey, baseUrl) => {
  const options = { apiKey };
  const url = (baseUrl || "").trim();
  if (url) options.baseURL = url;
  return options;
};

// Convenience factory used across services/controllers.
const createOpenAI = (apiKey, baseUrl) => new OpenAI(buildOpenAIOptions(apiKey, baseUrl));

module.exports = { buildOpenAIOptions, createOpenAI };
