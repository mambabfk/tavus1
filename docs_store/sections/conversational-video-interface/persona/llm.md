Large Language Model (LLM)
Learn how to use Tavus-optimized LLMs or integrate your own custom LLM. The LLM Layer in Tavus enables your persona to generate intelligent, context-aware responses. You can use Tavus-hosted models or connect your own OpenAI-compatible LLM. Configure the LLM under layers.llm when you Create Persona or update a persona.
1. model. Select one of the available models. tavus-gpt-oss is recommended as a good starting point. Model / Speed / Intelligence / Naturalness / Best For: tavus-gpt-oss — Snappy, low-latency. tavus-gpt-4.1 (deprecated) — Long-context reasoning. tavus-gpt-4o (deprecated) — Legacy option. tavus-gemini-2.5-flash — Latency + logical deduction. tavus-claude-haiku-4.5 — Grounded, fewer hallucinations. tavus-gpt-5.2 — General use, latency less critical. tavus-gpt-4o-mini (deprecated) — Legacy option. tavus-gemini-3-flash — Highest intelligence, lower speed.
Context Window Limit. Performance and intelligence are best when prompts are limited to 5,000 tokens. You may see degradations in speed and instruction following in the 15,000–20,000 token range. All Tavus-hosted models support up to 32,000 tokens; staying within 5k is recommended for optimal behavior. Tip: 1 token ≈ 4 characters, so 5,000 tokens ≈ 20,000 characters. "model": "tavus-gpt-oss"
2. tools. Optionally enable tool calling by defining functions the LLM can invoke. See LLM Tool Calling for more details.
3. speculative_inference. When set to true, the LLM begins processing speech transcriptions before user input ends, improving responsiveness. This is the default value; you can set it to false to disable. "speculative_inference": true. Defaults to true for better performance.
4. extra_body. Add parameters to customize the LLM request. For Tavus-hosted models, you can pass temperature and top_p: "extra_body": {"temperature": 0.7, "top_p": 0.9}
Example Configuration (Tavus-hosted):
{
  "persona_name": "Health Coach",
  "system_prompt": "You provide wellness tips and encouragement for people pursuing a healthy lifestyle.",
  "pipeline_mode": "full",
  "default_replica_id": "r90bbd427f71",
  "layers": {"llm": {"model": "tavus-gpt-oss", "speculative_inference": true, "extra_body": {"temperature": 0.7, "top_p": 0.9}}}
}
Custom LLM Prerequisites. To use your own OpenAI-compatible LLM, you'll need: Model name, Base URL, API key. Ensure your LLM is Streamable (i.e. via SSE) and uses the /chat/completions endpoint.
1. model. Name of the custom model you want to use. "model": "gpt-3.5-turbo"
2. base_url. Base URL of your LLM endpoint. Do not include route extensions in the base_url. "base_url": "https://your-llm.com/api/v1"
3. api_key. API key to authenticate with your LLM provider. base_url and api_key are required only when using a custom model.
6. headers. Optional additional headers to include when making requests to your LLM. "headers": {"X-Organization-ID": "your-org-id", "X-Request-Source": "tavus-cvi"}
7. extra_body. Add parameters to customize the LLM request. You can pass any parameters that your LLM provider supports: "extra_body": {"temperature": 0.5, "top_p": 0.9, "frequency_penalty": 0.5}
8. default_query. Add default query parameters that get appended to the base URL when making requests to the /chat/completions endpoint. "default_query": {"api-version": "2024-02-15-preview"}
Example Configuration (custom LLM):
{
  "persona_name": "Storyteller",
  "system_prompt": "You are a storyteller who entertains people of all ages.",
  "pipeline_mode": "full",
  "default_replica_id": "r90bbd427f71",
  "layers": {"llm": {"model": "gpt-4o", "base_url": "https://your-azure-openai.openai.azure.com/openai/deployments/gpt-4o", "api_key": "your-api-key", "speculative_inference": true, "default_query": {"api-version": "2024-02-15-preview"}}}
}
Perception with custom LLM. When using the raven-1 perception model with a custom LLM, your LLM will receive system messages containing visual context extracted from the user's video input. {"role": "system", "content": "<user_appearance>...</user_appearance> <user_emotions>...</user_emotions> <user_screenshare>...</user_screenshare>"}. If you disable the perception model, your LLM will not receive any special messages.
