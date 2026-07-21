import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
	DailyAudioTrack,
	DailyVideo,
	useDaily,
	useDevices,
	useLocalSessionId,
	useMeetingState,
	useScreenVideoTrack,
	useVideoTrack,
} from '@daily-co/daily-react';
import { MicSelectBtn, CameraSelectBtn, ScreenShareButton } from '../device-select';
import { ClosedCaptions, ClosedCaptionsButton, ClosedCaptionsProvider } from '../closed-captions';
import { ChatButton, ChatPanel, ChatProvider } from '../chat';
import { ConnectingState, LeavingState } from '../conversation-status';
import { useLocalScreenshare } from '../../hooks/use-local-screenshare';
import { useReplicaIDs } from '../../hooks/use-replica-ids';
import { useCVICall } from '../../hooks/use-cvi-call';
import { AudioWave } from '../audio-wave';

import styles from './conversation.module.css';

// A remote screen track counts as presenting from `loading` (switch the
// instant content starts arriving — docs guidance) and through transient
// `interrupted` states (keep the layout stable instead of flapping back to
// the face and re-splitting mid-hiccup). Off/undefined ends it.
const isPresentingState = (trackState) =>
	trackState === 'loading' || trackState === 'playable' || trackState === 'interrupted';

const VideoPreview = React.memo(({ id }) => {
	const videoState = useVideoTrack(id);

	return (
		<div
			className={`${styles.previewVideoContainer} ${videoState.isOff ? styles.previewVideoContainerHidden : ''}`}
		>
			<DailyVideo
				automirror
				sessionId={id}
				type="video"
				fit="cover"
				className={`${styles.previewVideo} ${videoState.isOff ? styles.previewVideoHidden : ''}`}
			/>

			<div className={styles.audioWaveContainer}>
				<AudioWave id={id} />
			</div>
		</div>
	);
});

const PreviewVideos = React.memo(() => {
	const localId = useLocalSessionId();
	const { isScreenSharing: rawScreenSharing } = useLocalScreenshare();
	// The builder's full-stage recording publishes this tab as a screenshare
	// purely as a recording tap — rendering it here would show an infinite
	// mirror. The host sets a window flag while that capture is live.
	const isScreenSharing = rawScreenSharing && !(typeof window !== 'undefined' && window.__tavusStageCapture);
	const replicaIds = useReplicaIDs();
	const replicaId = replicaIds[0];
	// When the PAL presents slides (its screenVideo track), keep its face
	// visible as a small preview beside the local camera.
	const replicaScreenState = useScreenVideoTrack(replicaId);
	const isReplicaPresenting = isPresentingState(replicaScreenState.state);

	return (
		<>
			{(isScreenSharing || isReplicaPresenting) && <VideoPreview id={replicaId} />}
			<VideoPreview id={localId} />
		</>
	);
});

const SelfView = React.memo(() => (
	<div className={styles.selfViewContainer}>
		<PreviewVideos />
	</div>
));

const MainVideo = React.memo(() => {
	const replicaIds = useReplicaIDs();
	const localId = useLocalSessionId();
	const videoState = useVideoTrack(replicaIds[0]);
	const screenVideoState = useScreenVideoTrack(localId);
	const meetingState = useMeetingState();
	// Ignore the builder's stage-capture share (recording tap, see above).
	const isScreenSharing = !screenVideoState.isOff && !(typeof window !== 'undefined' && window.__tavusStageCapture);
	const replicaId = replicaIds[0];
	// Slides from the presentation skill arrive as the REPLICA participant's
	// screenVideo track (not the local user's) — subscribe or they never show.
	const replicaScreenState = useScreenVideoTrack(replicaId);
	const isReplicaPresenting = isPresentingState(replicaScreenState.state);
	const [hasReplicaConnected, setHasReplicaConnected] = useState(false);

	useEffect(() => {
		if (replicaId && videoState.state === 'playable') {
			setHasReplicaConnected(true);
		}
	}, [replicaId, videoState.state]);

	if (meetingState === 'left-meeting' || meetingState === 'error') {
		return <LeavingState />;
	}

	if (!hasReplicaConnected) {
		return <ConnectingState />;
	}

	if (!replicaId) {
		return <ConnectingState />;
	}

	// Priority: the user's own screenshare > the PAL's slides > the PAL's face.
	const showingScreen = isScreenSharing || isReplicaPresenting;
	const mainSessionId = isScreenSharing ? localId : isReplicaPresenting ? replicaId : replicaId;
	const mainType = showingScreen ? 'screenVideo' : 'video';

	return (
		<div
			className={`${styles.mainVideoContainer} ${showingScreen ? styles.mainVideoContainerScreenSharing : ''}`}
		>
			{/* While presenting, slide content must never sit under the preview
			    thumbnails — mainVideoScreenSharing reserves a right-hand rail for
			    them and letterboxes the slide into the remaining space. */}
			<DailyVideo
				automirror
				sessionId={mainSessionId}
				type={mainType}
				className={`${styles.mainVideo}
				${showingScreen ? styles.mainVideoScreenSharing : ''}
				${videoState.isOff && !showingScreen ? styles.mainVideoHidden : ''}`}
			/>

			<DailyAudioTrack sessionId={replicaId} />
		</div>
	);
});

const MoreMenu = memo(() => {
	const [isOpen, setIsOpen] = useState(false);
	const ref = useRef(null);

	useEffect(() => {
		if (!isOpen) {
			return;
		}
		const handlePointerDown = (e) => {
			if (ref.current && !ref.current.contains(e.target)) {
				setIsOpen(false);
			}
		};
		const handleKey = (e) => {
			if (e.key === 'Escape') {
				setIsOpen(false);
			}
		};
		document.addEventListener('pointerdown', handlePointerDown);
		document.addEventListener('keydown', handleKey);
		return () => {
			document.removeEventListener('pointerdown', handlePointerDown);
			document.removeEventListener('keydown', handleKey);
		};
	}, [isOpen]);

	return (
		<div ref={ref} className={styles.moreMenu}>
			<button
				type="button"
				onClick={() => setIsOpen((v) => !v)}
				aria-pressed={isOpen}
				aria-label={isOpen ? 'Close more controls' : 'More controls'}
				aria-haspopup="true"
				aria-expanded={isOpen}
				className={`${styles.moreButton} ${isOpen ? styles.moreButtonActive : ''}`}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					aria-hidden="true"
					focusable="false"
				>
					<circle cx="5" cy="12" r="1.75" fill="currentColor" />
					<circle cx="12" cy="12" r="1.75" fill="currentColor" />
					<circle cx="19" cy="12" r="1.75" fill="currentColor" />
				</svg>
			</button>
			{isOpen && (
				<div className={styles.morePopover} role="menu">
					<ScreenShareButton />
					<ClosedCaptionsButton />
				</div>
			)}
		</div>
	);
});

MoreMenu.displayName = 'MoreMenu';

export const Conversation = React.memo(({ onLeave, conversationUrl }) => {
	const { joinCall, leaveCall } = useCVICall();
	const meetingState = useMeetingState();
	const { hasMicError } = useDevices();

	useEffect(() => {
		if (meetingState === 'error') {
			onLeave();
		}
	}, [meetingState, onLeave]);

	// The provider creates the Daily call object asynchronously, and child
	// effects run before parent effects — so a mount-only join fires while
	// `daily` is still null and daily?.join() silently no-ops, leaving the UI
	// on "Connecting…" forever. Gate on the call object and join once it exists.
	const daily = useDaily();
	useEffect(() => {
		if (!daily) return;
		joinCall({ url: conversationUrl });
		// Release the singleton call on unmount: otherwise the next mount's join()
		// is rejected ("already joined meeting") and the stale room's death ends
		// the new conversation via onLeave above. Also StrictMode-safe.
		return () => {
			leaveCall();
		};
	}, [daily, joinCall, leaveCall, conversationUrl]);

	const handleLeave = useCallback(() => {
		leaveCall();
		onLeave();
	}, [leaveCall, onLeave]);

	return (
		<ClosedCaptionsProvider>
			<ChatProvider>
				<div className={styles.containerWrapper}>
					<div className={styles.container}>
						<div className={styles.videoContainer}>
							{hasMicError && (
								<div className={styles.errorContainer}>
									<p>
										Camera or microphone access denied. Please check your settings and try again.
									</p>
								</div>
							)}

							<div className={styles.mainVideoContainer}>
								<MainVideo />
							</div>

							<SelfView />

							<ClosedCaptions />
						</div>

						<ChatPanel />

						<div
							className={`${styles.footer} ${meetingState === 'left-meeting' ? styles.footerLeaving : ''}`}
							aria-hidden={meetingState === 'left-meeting'}
						>
							<div className={styles.footerControls}>
								<MicSelectBtn />
								<CameraSelectBtn />
								<MoreMenu />
								<ChatButton />
								<button type="button" className={styles.leaveButton} onClick={handleLeave}>
									<span className={styles.leaveButtonIcon}>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="24"
											height="24"
											viewBox="0 0 24 24"
											fill="none"
											role="img"
											aria-label="Leave Call"
										>
											<path
												d="M18 6L6 18M6 6L18 18"
												stroke="currentColor"
												strokeWidth="2"
												strokeLinecap="round"
												strokeLinejoin="round"
											/>
										</svg>
									</span>
								</button>
							</div>
						</div>
					</div>
				</div>
			</ChatProvider>
		</ClosedCaptionsProvider>
	);
});
