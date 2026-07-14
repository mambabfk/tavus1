// Magic Canvas runtime: pure parsing, validation, normalization, and the
// constants the React surface and bridge code both need. Nothing in this file
// touches React, fetch, or the AppBridge so it stays trivially testable and
// portable across host runtimes.

import {
	isAllowedCanvasApiUrl,
	isAllowedCanvasMcpUrl,
	isAllowedCanvasSandboxUrl,
} from './allowlists.js';

export const CANVAS_INTERACTION_META_KEY = 'tavus.canvas.interaction';
export const SUPPORTED_CANVAS_CONFIG_VERSION = 1;
export const MAGIC_CANVAS_MIN_HEIGHT_PX = 240;
export const MAGIC_CANVAS_MAX_HEIGHT_PX = 720;
export const MIN_CANVAS_DISPLAY_SCALE = 0.85;
export const MAX_CANVAS_INSTANCES = 3;
export const CANVAS_CLEAR_TOOL_NAME = 'canvas_clear';
export const CANVAS_UPDATE_TOOL_NAME = 'update_component';

export const CANVAS_LAYOUT_SLOTS = [
	'safe-area-right',
	'safe-area-left',
	'safe-area-bottom',
	'full',
];

export const DEFAULT_CANVAS_LAYOUT_SLOT = 'safe-area-right';
export const DEFAULT_CANVAS_SAFE_AREA = {
	x: 275 / 1280,
	y: 111 / 720,
	width: 730 / 1280,
	height: 609 / 720,
};
export const DEFAULT_CANVAS_BACKDROP = {
	type: 'snapshot_mirror',
};
export const MAGIC_CANVAS_SIDE_PANEL_WIDTH_PX = 448;
export const MAGIC_CANVAS_SIDE_PANEL_INSET_PX = 16;
export const MAGIC_CANVAS_SIDE_PANEL_GUTTER_PX = 24;
export const MAGIC_CANVAS_SAFE_AREA_MIN_VIEWPORT_WIDTH_PX = 900;

export function isCanvasToolCallMessage(value) {
	if (!isRecord(value)) return false;

	return (
		value.message_type === 'conversation' &&
		value.event_type === 'conversation.tool_call' &&
		typeof value.conversation_id === 'string' &&
		isRecord(value.properties)
	);
}

export function parseCanvasConfig(value) {
	if (!isRecord(value)) return null;

	const component = readString(value, 'component');
	const componentVersion = readString(value, 'component_version');
	const sandboxUrl = readString(value, 'sandbox_url');
	const mcpServerUrl = readOptionalAllowedUrl(value, 'mcp_server_url', isAllowedCanvasMcpUrl);
	const apiBaseUrl = readOptionalAllowedUrl(value, 'api_base_url', isAllowedCanvasApiUrl);
	const interactionUrl = readOptionalAllowedUrl(value, 'interaction_url', isAllowedCanvasApiUrl);
	const layout = parseCanvasLayoutConfig(value.layout);
	const version = value.version;

	if (version !== SUPPORTED_CANVAS_CONFIG_VERSION) return null;
	if (!component || !componentVersion || !sandboxUrl) return null;
	if (!isAllowedCanvasSandboxUrl(sandboxUrl)) return null;
	if (mcpServerUrl === null || apiBaseUrl === null || interactionUrl === null) return null;
	if (layout === null) return null;

	return {
		version,
		component,
		component_version: componentVersion,
		resource_uri: readString(value, 'resource_uri'),
		sandbox_url: sandboxUrl,
		mcp_server_url: mcpServerUrl,
		mcp_tool_name: readString(value, 'mcp_tool_name'),
		api_base_url: apiBaseUrl,
		interaction_url: interactionUrl,
		layout,
		host_context: isRecord(value.host_context) ? value.host_context : undefined,
	};
}

/**
 * Returns the component id (e.g. "canvas.alert") of a Magic Canvas show
 * tool-call message, or null when the message is not a canvas show. Pure over
 * the tool-call message; host surfaces (e.g. the dev-portal post-test recap)
 * use it to record which on-screen element was displayed. Promoted into the
 * canonical runtime from the dev-portal-local copy (PROD-3563).
 */
export function getShownCanvasComponent(value) {
	if (!isCanvasToolCallMessage(value)) return null;
	if (value.canvas_config === undefined || value.canvas_config === null) return null;
	return parseCanvasConfig(value.canvas_config)?.component ?? null;
}

export function parseToolArguments(value) {
	if (value === undefined) return { ok: true, value: {} };
	if (isRecord(value)) return { ok: true, value };

	if (typeof value !== 'string') {
		return {
			ok: false,
			error: new Error('Magic Canvas tool arguments must be an object or JSON string.'),
		};
	}

	try {
		const parsed = JSON.parse(value);

		if (!isRecord(parsed)) {
			return {
				ok: false,
				error: new Error('Magic Canvas tool arguments must decode to an object.'),
			};
		}

		return { ok: true, value: parsed };
	} catch (error) {
		return { ok: false, error: toError(error) };
	}
}

export function parseCanvasControlCommand(message) {
	const toolName = message.properties.name;

	if (toolName !== CANVAS_CLEAR_TOOL_NAME && toolName !== CANVAS_UPDATE_TOOL_NAME) return null;

	const parsedArguments = parseToolArguments(message.properties.arguments);
	if (!parsedArguments.ok) throw parsedArguments.error;

	if (toolName === CANVAS_CLEAR_TOOL_NAME) {
		const toolCallId = parsedArguments.value.tool_call_id;
		const reason = parsedArguments.value.reason;

		if (toolCallId !== undefined && typeof toolCallId !== 'string') {
			throw new Error('Magic Canvas clear tool_call_id must be a string when provided.');
		}
		if (reason !== undefined && typeof reason !== 'string') {
			throw new Error('Magic Canvas clear reason must be a string when provided.');
		}

		return {
			kind: 'clear',
			conversation_id: message.conversation_id,
			tool_call_id: toolCallId,
			reason,
		};
	}

	const toolCallId = parsedArguments.value.tool_call_id;
	const updates = parsedArguments.value.updates;

	if (typeof toolCallId !== 'string' || toolCallId.length === 0) {
		throw new Error('Magic Canvas update_component requires a target tool_call_id.');
	}
	if (!isRecord(updates)) {
		throw new Error('Magic Canvas update_component requires an object updates payload.');
	}

	return {
		kind: 'update',
		conversation_id: message.conversation_id,
		tool_call_id: toolCallId,
		updates,
	};
}

const CANVAS_MODEL_SELECTABLE_SLOTS = ['safe-area-left', 'safe-area-right'];

function clampCanvasLayout(layout) {
	const preferred_slot = CANVAS_MODEL_SELECTABLE_SLOTS.includes(layout.preferred_slot)
		? layout.preferred_slot
		: DEFAULT_CANVAS_LAYOUT_SLOT;
	if (preferred_slot === layout.preferred_slot && layout.display_mode === 'inline') {
		return layout;
	}
	return { ...layout, preferred_slot, display_mode: 'inline' };
}

function canvasEffectiveSlot(layout) {
	return layout.display_mode === 'fullscreen' ? 'full' : layout.preferred_slot;
}

// Single-card policy: a newly shown or updated card replaces what was on screen.
function enforceCanvasSlotExclusivity(_others, target) {
	return [target];
}

export function applyCanvasCommand(current, command) {
	switch (command.kind) {
		case 'show': {
			const existing = current.find((item) => item.id === command.instance.id);
			const nextInstance = existing
				? { ...command.instance, revision: existing.revision + 1 }
				: command.instance;
			const others = current.filter((item) => item.id !== command.instance.id);
			return enforceCanvasSlotExclusivity(others, nextInstance);
		}
		case 'update': {
			// Commands are conversation-scoped: a stale or cross-conversation
			// command whose tool_call_id happens to collide must not mutate the
			// current canvas (tool_call_ids are LLM-generated and not unique
			// across conversations).
			const matchesTarget = (item) =>
				item.conversation_id === command.conversation_id &&
				item.tool_call_id === command.tool_call_id;
			const update = splitCanvasRuntimeArguments(command.updates);
			let updated;
			const mapped = current.map((item) => {
				if (!matchesTarget(item)) return item;
				const next = {
					...item,
					arguments: { ...item.arguments, ...update.componentArguments },
					layout: clampCanvasLayout({
						preferred_slot: update.preferredSlot ?? item.layout.preferred_slot,
						display_mode: update.displayMode ?? item.layout.display_mode,
						avoid_safe_area: update.avoidSafeArea ?? item.layout.avoid_safe_area,
						safe_area: update.safeArea ?? item.layout.safe_area,
						backdrop: update.backdrop ?? item.layout.backdrop,
					}),
					revision: item.revision + 1,
				};
				updated = next;
				return next;
			});
			if (updated === undefined) return mapped;
			const prev = current.find(matchesTarget);
			if (prev && canvasEffectiveSlot(prev.layout) === canvasEffectiveSlot(updated.layout)) {
				return mapped;
			}
			const rest = mapped.filter((item) => !matchesTarget(item));
			return enforceCanvasSlotExclusivity(rest, updated);
		}
		case 'clear':
			// Clear-all is scoped to the command's conversation; targeted clear
			// must match both conversation and tool_call_id.
			if (!command.tool_call_id)
				return current.filter((item) => item.conversation_id !== command.conversation_id);
			return current.filter(
				(item) =>
					!(
						item.conversation_id === command.conversation_id &&
						item.tool_call_id === command.tool_call_id
					)
			);
	}
}

export function extractCanvasInteraction(message) {
	if (!isRecord(message) || !Array.isArray(message.content)) return null;

	for (const block of message.content) {
		if (!isRecord(block)) continue;
		const meta = isRecord(block._meta) ? block._meta : null;
		const interaction = meta?.[CANVAS_INTERACTION_META_KEY];

		if (isRecord(interaction)) {
			return toPendingInteraction(interaction);
		}
	}

	return null;
}

export function normalizeInteraction(instance, payload) {
	const interactionType = payload.type;
	const value = payload.value;

	if (!interactionType) {
		throw new Error('Magic Canvas interaction is missing type.');
	}

	if (value === undefined) {
		throw new Error('Magic Canvas interaction is missing value.');
	}

	return {
		interaction_id:
			payload.interaction_id ?? createInteractionId(instance.tool_call_id, interactionType),
		conversation_id: instance.conversation_id,
		tool_call_id: instance.tool_call_id,
		component: payload.component ?? instance.canvas_config.component,
		component_version: payload.component_version ?? instance.canvas_config.component_version,
		type: interactionType,
		value,
		metadata: isRecord(payload.metadata) ? payload.metadata : {},
	};
}

export function shouldCompleteCanvasInteraction(event) {
	if (event.type === 'dismiss' || event.type === 'clear') return true;
	if (event.type !== 'submit' && event.type !== 'skip') return false;
	return (
		event.component === 'canvas.question' ||
		event.component === 'canvas.input' ||
		event.component === 'canvas.calendar'
	);
}

export function extractTextContent(message) {
	if (!isRecord(message) || !Array.isArray(message.content)) return '';

	return message.content
		.map((block) =>
			isRecord(block) && block.type === 'text' && typeof block.text === 'string' ? block.text : ''
		)
		.filter(Boolean)
		.join('\n')
		.trim();
}

export function buildCanvasModelContextAppend(instance, update) {
	const structuredContent = isRecord(update.structuredContent)
		? update.structuredContent
		: undefined;
	const contentText = extractContentText(update.content);
	const state = typeof structuredContent?.state === 'string' ? structuredContent.state : 'updated';
	const summary =
		typeof structuredContent?.summary === 'string' ? structuredContent.summary : contentText;
	const sections = [
		`Magic Canvas state update for ${instance.canvas_config.component} (${instance.tool_call_id}).`,
		`State: ${state}.`,
	];

	if (summary) sections.push(`Summary: ${summary}`);
	if (structuredContent) {
		sections.push(`Structured state: ${safeStringify(structuredContent)}`);
	}
	if (contentText && contentText !== summary) sections.push(contentText);

	return sections.join('\n');
}

export function buildHostContext(
	instance,
	layout = resolveCanvasLayout(instance, defaultCanvasViewport())
) {
	return {
		...instance.canvas_config.host_context,
		displayMode: layout.display_mode,
		availableDisplayModes: ['inline', 'fullscreen'],
		containerDimensions: canvasContainerDimensions(layout),
		layout: {
			preferred_slot: layout.preferred_slot,
			viable_slot: layout.viable_slot,
			avoid_safe_area: layout.avoid_safe_area,
			safe_area: layout.safe_area,
			backdrop: layout.backdrop,
		},
		userAgent: '@tavus/cvi-ui magic-canvas',
		platform: 'web',
	};
}

export function createCanvasInstance({ conversationId, toolCallId, args, canvasConfig }) {
	const runtimeArgs = splitCanvasRuntimeArguments(args);

	return {
		id: toolCallId,
		conversation_id: conversationId,
		tool_call_id: toolCallId,
		arguments: runtimeArgs.componentArguments,
		canvas_config: canvasConfig,
		layout: clampCanvasLayout({
			preferred_slot:
				runtimeArgs.preferredSlot ??
				canvasConfig.layout?.preferred_slot ??
				defaultLayoutSlotForComponent(canvasConfig.component),
			display_mode: runtimeArgs.displayMode ?? 'inline',
			avoid_safe_area: runtimeArgs.avoidSafeArea ?? canvasConfig.layout?.avoid_safe_area ?? true,
			safe_area: runtimeArgs.safeArea ?? canvasConfig.layout?.safe_area ?? DEFAULT_CANVAS_SAFE_AREA,
			backdrop: runtimeArgs.backdrop ?? canvasConfig.layout?.backdrop ?? DEFAULT_CANVAS_BACKDROP,
		}),
		revision: 0,
	};
}

export function resolveCanvasLayout(instance, viewport) {
	const displayMode = instance.layout.display_mode;

	return {
		...instance.layout,
		display_mode: displayMode,
		viable_slot:
			displayMode === 'fullscreen'
				? 'full'
				: resolveCanvasLayoutSlot(instance.layout.preferred_slot, viewport),
	};
}

export function resolveCanvasSidecarLayout(layouts, viewport) {
	const sideLayouts = layouts.filter((layout) => {
		if (!layout.avoid_safe_area || layout.display_mode === 'fullscreen') return false;
		return layout.viable_slot === 'safe-area-left' || layout.viable_slot === 'safe-area-right';
	});
	const hasLeft = sideLayouts.some((layout) => layout.viable_slot === 'safe-area-left');
	const hasRight = sideLayouts.some((layout) => layout.viable_slot === 'safe-area-right');
	// When canvases occupy both sides, shifting the video toward either one
	// would just unbalance the persona. Keep it centered, let the cards sit on
	// top of the video edges, and skip the mirror backdrop since there is no
	// single gap to fill.
	if (hasLeft && hasRight) {
		return {
			active: false,
			video_shift_x: 0,
			backdrop: DEFAULT_CANVAS_BACKDROP,
		};
	}
	const activeLayout = [...sideLayouts].reverse()[0];

	if (!activeLayout || viewport.width < MAGIC_CANVAS_SAFE_AREA_MIN_VIEWPORT_WIDTH_PX) {
		return {
			active: false,
			video_shift_x: 0,
			backdrop: DEFAULT_CANVAS_BACKDROP,
		};
	}

	const panelWidth = Math.min(
		MAGIC_CANVAS_SIDE_PANEL_WIDTH_PX,
		Math.max(0, viewport.width - MAGIC_CANVAS_SIDE_PANEL_INSET_PX * 2)
	);
	const safeArea = activeLayout.safe_area;
	const safeAreaLeft = safeArea.x * viewport.width;
	const safeAreaRight = (safeArea.x + safeArea.width) * viewport.width;
	const maxShift = Math.min(360, viewport.width * 0.3);
	let videoShiftX = 0;

	if (activeLayout.viable_slot === 'safe-area-left') {
		const panelRight =
			MAGIC_CANVAS_SIDE_PANEL_INSET_PX + panelWidth + MAGIC_CANVAS_SIDE_PANEL_GUTTER_PX;
		videoShiftX = clamp(panelRight - safeAreaLeft, 0, maxShift);
	} else {
		const panelLeft =
			viewport.width -
			MAGIC_CANVAS_SIDE_PANEL_INSET_PX -
			panelWidth -
			MAGIC_CANVAS_SIDE_PANEL_GUTTER_PX;
		videoShiftX = -clamp(safeAreaRight - panelLeft, 0, maxShift);
	}

	return {
		active: true,
		side: activeLayout.viable_slot === 'safe-area-left' ? 'left' : 'right',
		video_shift_x: Math.round(videoShiftX),
		safe_area: safeArea,
		backdrop: activeLayout.backdrop,
	};
}

export function resolveCanvasLayoutSlot(preferredSlot, viewport) {
	if (preferredSlot === 'full') return 'full';

	if (
		preferredSlot === 'safe-area-bottom' &&
		viewport.visualViewportHeight !== undefined &&
		viewport.visualViewportHeight < viewport.height * 0.75
	) {
		return 'full';
	}

	if (
		(preferredSlot === 'safe-area-left' || preferredSlot === 'safe-area-right') &&
		viewport.width < 768 &&
		viewport.height >= viewport.width
	) {
		return 'safe-area-bottom';
	}

	return preferredSlot;
}

export function splitCanvasRuntimeArguments(args) {
	const componentArguments = {};

	for (const [key, value] of Object.entries(args)) {
		if (
			key === 'layout' ||
			key === 'preferred_slot' ||
			key === 'preferredSlot' ||
			key === 'display_mode' ||
			key === 'displayMode' ||
			key === 'presentation' ||
			key === 'fullscreen' ||
			key === 'avoid_safe_area' ||
			key === 'avoidSafeArea' ||
			key === 'safe_area' ||
			key === 'safeArea' ||
			key === 'backdrop'
		) {
			continue;
		}

		componentArguments[key] = value;
	}

	return {
		componentArguments,
		preferredSlot:
			parseCanvasLayoutPreference(args.layout) ??
			parseCanvasLayoutPreference(args.preferred_slot) ??
			parseCanvasLayoutPreference(args.preferredSlot),
		displayMode: parseCanvasDisplayMode(args),
		avoidSafeArea: parseCanvasAvoidSafeArea(args),
		safeArea: parseCanvasSafeAreaFromArguments(args),
		backdrop: parseCanvasBackdropFromArguments(args),
	};
}

export function defaultLayoutSlotForComponent(component) {
	switch (component) {
		case 'canvas.alert':
			return 'safe-area-bottom';
		case 'canvas.chart':
		case 'canvas.image':
		case 'canvas.video':
			return 'full';
		default:
			return DEFAULT_CANVAS_LAYOUT_SLOT;
	}
}

export function canvasContainerDimensions(layout, options) {
	const displayScale = options?.displayScale ?? 1;

	if (layout.display_mode === 'fullscreen' || layout.viable_slot === 'full') {
		return {
			maxWidth: undefined,
			maxHeight: undefined,
			displayScale,
		};
	}

	const maxHeight = options?.maxHeight ?? MAGIC_CANVAS_MAX_HEIGHT_PX;

	if (layout.viable_slot === 'safe-area-bottom') {
		return {
			maxWidth: 720,
			maxHeight,
			displayScale,
		};
	}

	return {
		width: 384,
		maxHeight,
		displayScale,
	};
}

export function createInteractionId(toolCallId, interactionType) {
	const safeToolCallId = toolCallId.replace(/[^a-zA-Z0-9_-]/g, '_');
	const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);

	return `ci_${safeToolCallId}_${interactionType}_${random}`;
}

export function isRecord(value) {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toError(error) {
	return error instanceof Error ? error : new Error(String(error));
}

function extractContentText(content) {
	if (!Array.isArray(content)) return '';

	return content
		.map((block) =>
			isRecord(block) && block.type === 'text' && typeof block.text === 'string' ? block.text : ''
		)
		.filter(Boolean)
		.join('\n')
		.trim();
}

function safeStringify(value) {
	const serialized = JSON.stringify(value);
	if (!serialized) return '{}';
	if (serialized.length <= 2000) return serialized;
	return `${serialized.slice(0, 2000)}...`;
}

function parseCanvasLayoutConfig(value) {
	if (value === undefined) return undefined;
	if (!isRecord(value)) return null;

	const preferredSlot = parseCanvasLayoutPreference(value);
	const safeArea = parseCanvasSafeArea(value.safe_area ?? value.safeArea);
	const backdrop = parseCanvasBackdrop(value.backdrop);

	if (safeArea === null || backdrop === null) return null;

	return {
		...(preferredSlot ? { preferred_slot: preferredSlot } : {}),
		...parseOptionalBooleanConfig(value.avoid_safe_area ?? value.avoidSafeArea, 'avoid_safe_area'),
		...(safeArea ? { safe_area: safeArea } : {}),
		...(backdrop ? { backdrop } : {}),
	};
}

function parseCanvasLayoutPreference(value) {
	if (typeof value === 'string' && isCanvasLayoutSlot(value)) return value;
	if (!isRecord(value)) return undefined;

	const preferredSlot = value.preferred_slot ?? value.preferredSlot ?? value.slot;
	return typeof preferredSlot === 'string' && isCanvasLayoutSlot(preferredSlot)
		? preferredSlot
		: undefined;
}

function parseCanvasDisplayMode(args) {
	if (args.presentation === true || args.fullscreen === true) return 'fullscreen';
	if (args.presentation === false || args.fullscreen === false) return 'inline';

	const displayMode = args.display_mode ?? args.displayMode;
	return displayMode === 'fullscreen' || displayMode === 'inline' ? displayMode : undefined;
}

function parseCanvasAvoidSafeArea(args) {
	const layout = isRecord(args.layout) ? args.layout : undefined;
	const value =
		args.avoid_safe_area ?? args.avoidSafeArea ?? layout?.avoid_safe_area ?? layout?.avoidSafeArea;
	return typeof value === 'boolean' ? value : undefined;
}

function parseCanvasSafeAreaFromArguments(args) {
	const layout = isRecord(args.layout) ? args.layout : undefined;
	const parsed = parseCanvasSafeArea(
		args.safe_area ?? args.safeArea ?? layout?.safe_area ?? layout?.safeArea
	);
	return parsed ?? undefined;
}

function parseCanvasBackdropFromArguments(args) {
	const layout = isRecord(args.layout) ? args.layout : undefined;
	const parsed = parseCanvasBackdrop(args.backdrop ?? layout?.backdrop);
	return parsed ?? undefined;
}

function parseCanvasSafeArea(value) {
	if (value === undefined) return undefined;
	if (!isRecord(value)) return null;

	const x = readNumber(value, 'x');
	const y = readNumber(value, 'y');
	const width = readNumber(value, 'width');
	const height = readNumber(value, 'height');

	if (x === undefined || y === undefined || width === undefined || height === undefined) {
		return null;
	}
	if (x < 0 || y < 0 || width <= 0 || height <= 0) return null;
	if (x + width > 1.001 || y + height > 1.001) return null;

	return {
		x: clamp(x, 0, 1),
		y: clamp(y, 0, 1),
		width: clamp(width, 0, 1),
		height: clamp(height, 0, 1),
	};
}

function parseCanvasBackdrop(value) {
	if (value === undefined) return undefined;
	if (value === 'snapshot_mirror' || value === 'none') return { type: value };
	if (!isRecord(value)) return null;

	const type = value.type;
	if (type === 'snapshot_mirror' || type === 'none') return { type };
	return null;
}

function parseOptionalBooleanConfig(value, key) {
	return typeof value === 'boolean' ? { [key]: value } : {};
}

function isCanvasLayoutSlot(value) {
	return CANVAS_LAYOUT_SLOTS.includes(value);
}

function defaultCanvasViewport() {
	return {
		width: globalThis.innerWidth || 1024,
		height: globalThis.innerHeight || 768,
		visualViewportHeight: globalThis.visualViewport?.height,
	};
}

function readString(value, key) {
	const field = value[key];
	return typeof field === 'string' && field.length > 0 ? field : undefined;
}

function readNumber(value, key) {
	const field = value[key];
	return typeof field === 'number' && Number.isFinite(field) ? field : undefined;
}

function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

function readOptionalAllowedUrl(value, key, isAllowed) {
	const url = readString(value, key);
	if (!url) return undefined;
	return isAllowed(url) ? url : null;
}

function toPendingInteraction(value) {
	if (value.interaction_id !== undefined && typeof value.interaction_id !== 'string') return null;
	if (value.component !== undefined && typeof value.component !== 'string') return null;
	if (value.component_version !== undefined && typeof value.component_version !== 'string')
		return null;
	if (value.type !== undefined && typeof value.type !== 'string') return null;
	if (value.metadata !== undefined && !isRecord(value.metadata)) return null;

	return value;
}
