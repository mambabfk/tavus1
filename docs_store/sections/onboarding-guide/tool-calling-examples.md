Tavus Tool Calling
Key guidelines for implementing reliable tool calls in Tavus conversational agents. New to tool calling? Start with the Tool Calling for LLM guide. This page focuses on best practices for building reliable tool integrations.
How Tavus Tool Calls Work. Tool calls allow Tavus agents to interact with external systems such as APIs, databases, and internal services. High-level flow:
User speaks → (to Tavus)
Tavus LLM triggers `conversation.tool_call` event → (Tavus → Your app)
Your app receives `conversation.tool_call` event → (Your app executes)
Execute your backend logic (API calls, DB queries, etc.) → (Your app → Tavus)
Send results via `conversation.echo` or `conversation.append_llm_context` → (Tavus → User)
LLM generates natural language response to user.
Tavus does not execute tool calls on the backend. You must implement event listeners in your frontend to handle conversation.tool_call events and execute your own logic when a tool is invoked. Because Tavus agents operate in live conversational environments, tool design should prioritize reliability, clarity, and conversational continuity. The six most important principles:
1. Keep Tool Schemas Clear and Explicit. Ambiguous parameters make it harder for the model to choose and populate tools correctly. Prefer narrow tools with explicit parameters. Bad: {"name": "lookup_customer", "parameters": {"query": "string"}}. Better: {"name": "lookup_customer_by_email", "parameters": {"customer_email": "string"}}. Clear schemas reduce incorrect tool usage and improve consistency.
2. Separate Read Tools from Write Tools. Read tools retrieve information and are safe to call frequently (retrieving account data, searching knowledge bases, checking order status). Write tools modify system state (creating support tickets, sending emails, updating records) and should only run when user intent is clear and parameters are validated.
3. Keep Tool Results Small. Echo interactions are the output of a tool call and are injected back into the model's context. Large payloads increase token usage and degrade quality. Keep conversation.echo interactions small — return only the fields needed for the next response. Example: {"message_type": "conversation", "event_type": "conversation.echo", "conversation_id": "<conversation_id>", "properties": {"modality": "text", "text": "Customer Jane Doe is on the Enterprise plan."}}.
4. Avoid Triggering Tools Too Early. In real-time conversations users may interrupt or revise requests. Make "intent is clear" operational with concrete criteria: required slots are present (e.g. email, issue_type), no unresolved ambiguity, user gave explicit confirmation for write actions. Wait until intent is clear; avoid executing write actions mid-sentence; let the conversation stabilize before triggering tools.
Recommended system prompt addendum (copy-paste). Tool invocation policy:
- Only call write tools when user intent is explicit and all required parameters are present.
- If any required parameter is missing, ask a follow-up question instead of calling a tool.
- If the user's wording is ambiguous, ask for clarification before calling a tool.
- For irreversible/state-changing actions (create, update, send, submit, charge, delete), require explicit user confirmation immediately before calling the tool.
- Do not call the same write tool repeatedly for the same request unless the user explicitly asks to retry.
- Read-only tools may be called without confirmation when they directly answer the user's request.
- Keep tool results small; if you need the replica to speak them, summarize succinctly before using conversation.echo.
5. Log Tool Calls for Observability. Production systems should log tool activity. In addition to backend execution logs, listen to Tavus app-events (Daily app-message events) for end-to-end observability: trace when conversation.tool_call was emitted, what payload was received, what your app executed, and what response was returned.
