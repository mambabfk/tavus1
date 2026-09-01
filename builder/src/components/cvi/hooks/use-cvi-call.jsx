import { useCallback } from 'react';
import { useDaily } from '@daily-co/daily-react';

export const useCVICall = () => {
	const daily = useDaily();

	const joinCall = useCallback(
		({ url }) => {
			// No Krisp noise-cancellation processor: the WASM audio processing
			// runs for the whole call and competes with remote playout on
			// marginal demo laptops (audio lags lipsync, then speeds up to
			// catch up). The replica doesn't need studio-clean visitor audio.
			daily?.join({ url: url });
		},
		[daily]
	);

	const leaveCall = useCallback(() => {
		daily?.leave();
	}, [daily]);

	return { joinCall, leaveCall };
};
