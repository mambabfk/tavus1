import { useCallback, useMemo, useReducer } from 'react';
import { useObservableEvent, useSendAppMessage } from './cvi-events-hooks';

export function makeMessageId(inferenceId, role) {
	return `${inferenceId}:${role}`;
}

export function applyUtterance(prev, event, now) {
	const speech = event.properties.speech;
	const role = event.properties.role;
	if (!speech || (role !== 'user' && role !== 'replica')) {
		return prev;
	}
	const id = makeMessageId(event.inference_id, role);

	let base = prev;
	if (role === 'user') {
		const trimmed = speech.trim();
		base = prev.filter(
			(m) => !(m.id.startsWith('local-') && m.role === 'user' && m.text.trim() === trimmed)
		);
	}

	const existingIdx = base.findIndex((m) => m.id === id);
	if (existingIdx >= 0) {
		const next = base.slice();
		next[existingIdx] = { ...next[existingIdx], text: speech };
		return next;
	}
	return [...base, { id, role, text: speech, createdAt: now }];
}

export function appendOptimistic(prev, text, id, now) {
	return [...prev, { id, role: 'user', text, createdAt: now }];
}

function chatReducer(state, action) {
	switch (action.type) {
		case 'utterance':
			return {
				messages: applyUtterance(state.messages, action.event, action.now),
				conversationId: state.conversationId ?? action.event.conversation_id ?? null,
			};
		case 'optimistic':
			return {
				...state,
				messages: appendOptimistic(state.messages, action.text, action.id, action.now),
			};
	}
}

const INITIAL_STATE = { messages: [], conversationId: null };

function generateLocalId() {
	const cryptoObj = globalThis.crypto;
	if (cryptoObj?.randomUUID) {
		return `local-${cryptoObj.randomUUID()}`;
	}
	return `local-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export function useChat() {
	const [state, dispatch] = useReducer(chatReducer, INITIAL_STATE);
	const sendAppMessage = useSendAppMessage();

	useObservableEvent(
		useCallback((event) => {
			if (event.event_type === 'conversation.utterance') {
				dispatch({
					type: 'utterance',
					event,
					now: Date.now(),
				});
			}
		}, [])
	);

	const sendMessage = useCallback(
		(text) => {
			const trimmed = text.trim();
			if (!trimmed || !state.conversationId) {
				return;
			}
			const id = generateLocalId();
			dispatch({ type: 'optimistic', text: trimmed, id, now: Date.now() });
			sendAppMessage({
				message_type: 'conversation',
				event_type: 'conversation.respond',
				conversation_id: state.conversationId,
				properties: { text: trimmed },
			});
		},
		[state.conversationId, sendAppMessage]
	);

	return useMemo(
		() => ({
			messages: state.messages,
			conversationId: state.conversationId,
			sendMessage,
		}),
		[state.messages, state.conversationId, sendMessage]
	);
}
