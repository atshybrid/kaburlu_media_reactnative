import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
let VideoView: any;
// Lazy import to avoid undefined component during fast refresh if native module not ready
import('expo-video')
	.then((mod) => {
		VideoView = (mod as any).VideoView;
	})
	.catch(() => {
		VideoView = undefined as any;
	});

// Suppress expo-keep-awake activation errors (expo-video dependency issue)
if (typeof globalThis !== 'undefined') {
	const origErr = console.error;
	console.error = (...args: any[]) => {
		const msg = String(args[0] || '');
		if (msg.includes('Unable to activate keep awake')) return;
		origErr.apply(console, args);
	};
}

type VideoWrapperProps = {
	player: any;
	style?: StyleProp<ViewStyle>;
	contentFit?: 'cover' | 'contain' | 'fill' | 'none' | string;
	nativeControls?: boolean;
};

export const VideoWrapper: React.FC<VideoWrapperProps> = ({ player, style, contentFit = 'cover', nativeControls = true }) => {
	// If native view or player isn't ready, render a harmless placeholder to avoid invalid element crash
	if (!VideoView || !player) {
		return <View style={style} />;
	}
	return (
		<VideoView
			player={player}
			style={style}
			contentFit={contentFit as any}
			nativeControls={nativeControls}
		/>
	);
};

export default VideoWrapper;

