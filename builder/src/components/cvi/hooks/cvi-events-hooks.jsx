import { useCallback } from 'react';
import { useAppMessage, useDailyEvent } from '@daily-co/daily-react';

// Every event broadcast by Tavus carries `seq` for global monotonic ordering
// and `turn_idx` for grouping events by conversational turn.
// See the Interactions Protocol docs ("Event Ordering and Turn Tracking").

// Streaming utterance event — emitted as either side speaks. Reflects what was
// actually spoken/transcribed (vs. `conversation.utterance` role=replica which
// contains the full intended LLM response, even if interrupted).

// Canonical role-based speaking events (current Tavus schema). Use the `role`
// field in `properties` to identify the speaker.

// Legacy per-role speaking events. Kept for backward compatibility with older
// Tavus deployments that may still emit them.

export function useObservableEvent(callback) {
	return useDailyEvent(
		'app-message',
		useCallback(
			(event) => {
				callback(event.data);
			},
			[callback]
		)
	);
}

export function useSendAppMessage() {
	const sendAppMessage = useAppMessage();

	return useCallback(
		(message) => {
			sendAppMessage(message, '*');
		},
		[sendAppMessage]
	);
}
