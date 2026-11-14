import React, { useRef, useEffect, useCallback } from "react";

interface WavySliderProps {
	value: number; // 0 to 1
	onChange?: (val: number) => void;
	playing?: boolean;
	fillColor?: string;
	trackColor?: string;
	handleColor?: string;
	height?: number;
	className?: string;
}

export const WavySlider: React.FC<WavySliderProps> = ({
	value,
	onChange,
	playing = false,
	fillColor = "#38bdf8",
	trackColor = "rgba(255, 255, 255, 0.15)",
	handleColor = "#ffffff",
	height = 24,
	className = ""
}) => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const phaseRef = useRef<number>(0);
	const animIdRef = useRef<number | null>(null);
	const isDraggingRef = useRef<boolean>(false);

	// Render canvas frame
	const draw = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;

		if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
			canvas.width = w * dpr;
			canvas.height = h * dpr;
		}

		ctx.save();
		ctx.scale(dpr, dpr);
		ctx.clearRect(0, 0, w, h);

		const midY = h / 2;
		const clampedVal = Math.max(0, Math.min(1, value));
		const fillW = w * clampedVal;

		// 1. Draw remaining track (background line)
		const startUnfilled = Math.min(w, fillW + (clampedVal > 0 && clampedVal < 1 ? 4 : 0));
		if (startUnfilled < w) {
			ctx.beginPath();
			ctx.lineWidth = 3.2;
			ctx.lineCap = "round";
			ctx.strokeStyle = trackColor;
			ctx.moveTo(startUnfilled, midY);
			ctx.lineTo(w - 2, midY);
			ctx.stroke();

			// Subtle end dot
			ctx.beginPath();
			ctx.arc(w - 2, midY, 1.8, 0, 2 * Math.PI);
			ctx.fillStyle = trackColor;
			ctx.fill();
		}

		// 2. Draw filled portion (wavy when playing)
		if (fillW > 0) {
			ctx.beginPath();
			ctx.lineWidth = 3.2;
			ctx.lineCap = "round";
			ctx.strokeStyle = fillColor;

			if (fillW > 12) {
				const wavelength = 26;
				const amplitude = 3.2;

				ctx.moveTo(0, midY);
				for (let x = 0; x <= fillW; x += 3) {
					// Fade in amplitude at start and near handle
					let ampFactor = Math.min(1.0, x / 16);
					const endDist = fillW - x;
					if (endDist < 8) ampFactor *= endDist / 8;

					const y =
						midY +
						Math.sin((x / wavelength - phaseRef.current) * 2 * Math.PI) *
							amplitude *
							ampFactor;
					ctx.lineTo(x, y);
				}
			} else {
				ctx.moveTo(0, midY);
				ctx.lineTo(fillW, midY);
			}
			ctx.stroke();
		}

		// 3. Draw pill handle
		if (fillW >= 0 && fillW <= w) {
			const handleH = isDraggingRef.current ? 18 : 14;
			const handleW = 4;
			const hx = Math.max(2, Math.min(w - handleW - 2, fillW));
			const hy1 = midY - handleH / 2;
			const hy2 = midY + handleH / 2;

			ctx.strokeStyle = handleColor;
			ctx.lineWidth = handleW;
			ctx.lineCap = "round";
			ctx.beginPath();
			ctx.moveTo(hx, hy1);
			ctx.lineTo(hx, hy2);
			ctx.stroke();
		}

		ctx.restore();
	}, [value, fillColor, trackColor, handleColor]);

	// Animation loop for wave phase
	useEffect(() => {
		let lastTime = performance.now();

		const loop = (time: number) => {
			const dt = time - lastTime;
			lastTime = time;

			if (playing) {
				// 2200ms per full cycle matching WavySlider.qml
				phaseRef.current = (phaseRef.current + dt / 2200) % 1;
				draw();
				animIdRef.current = requestAnimationFrame(loop);
			} else {
				draw();
			}
		};

		draw();
		if (playing) {
			animIdRef.current = requestAnimationFrame(loop);
		}

		return () => {
			if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
		};
	}, [playing, draw]);

	// Mouse interaction
	const handlePointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const clickX = e.clientX - rect.left;
		const newVal = Math.max(0, Math.min(1, clickX / rect.width));
		onChange?.(newVal);
	};

	const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
		e.stopPropagation();
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
		isDraggingRef.current = true;
		handlePointer(e);
	};

	const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
		if (isDraggingRef.current) {
			e.stopPropagation();
			handlePointer(e);
		}
	};

	const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
		if (isDraggingRef.current) {
			e.stopPropagation();
			isDraggingRef.current = false;
			try {
				(e.target as HTMLElement).releasePointerCapture(e.pointerId);
			} catch {}
			draw();
		}
	};

	return (
		<div
			className={className}
			style={{
				position: "relative",
				width: "100%",
				height: `${height}px`,
				cursor: "pointer",
				display: "flex",
				alignItems: "center"
			}}
		>
			<canvas
				ref={canvasRef}
				style={{
					width: "100%",
					height: "100%",
					display: "block"
				}}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
			/>
		</div>
	);
};
