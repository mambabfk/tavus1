import { useCallback, useRef, useState } from 'react';
import { useObservableEvent } from './cvi-events-hooks';

const CAPTION_CLEAR_DELAY_MS = 2000;

// `enabled` gates the per-chunk setState: utterance.streaming fires roughly
// per word while anyone speaks, and captions default OFF — updating state
// for a hidden UI was the highest-frequency React work on a plain call.
export const useClosedCaption = (enabled = true) => {
	const [caption, setCaption] = useState(null);
	const clearTimer = useRef(null);

	const update = useCallback((next, final) => {
		setCaption(next);
		if (clearTimer.current !== null) {
			clearTimeout(clearTimer.current);
			clearTimer.current = null;
		}
		if (final) {
			clearTimer.current = setTimeout(() => {
				setCaption(null);
				clearTimer.current = null;
			}, CAPTION_CLEAR_DELAY_MS);
		}
	}, []);

	useObservableEvent(
		useCallback(
			(event) => {
				if (!enabled) return;
				if (event.event_type === 'conversation.utterance.streaming') {
					const { role, speech, final } = event.properties;
					if (role === 'user' || role === 'replica') {
						update({ role, text: speech }, final ?? false);
					}
				}
			},
			[update, enabled]
		)
	);

	return caption;
};
