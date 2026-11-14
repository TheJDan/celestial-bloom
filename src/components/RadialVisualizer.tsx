import React, { useRef, useEffect, useCallback } from "react";

interface RadialVisualizerProps {
	active?: boolean;
	barColor?: string;
	innerRadius?: number;
	maxMagnitude?: number;
	barCount?: number;
	className?: string;
}

export const RadialVisualizer: React.FC<RadialVisualizerProps> = ({
	active = false,
	barColor = "#38bdf8",
	innerRadius = 78,
	maxMagnitude = 20,
	barCount = 36,
	className = ""
}) => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const tickRef = useRef<number>(0);
	const animIdRef = useRef<number | null>(null);

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

		const cx = w / 2;
		const cy = h / 2;
		const r = innerRadius + 4;
		const t = tickRef.current;

		ctx.lineWidth = 2.4;
		ctx.lineCap = "round";
		ctx.strokeStyle = barColor;
		ctx.beginPath();

		for (let i = 0; i < barCount; i++) {
			const angle = (i / barCount) * 2 * Math.PI - Math.PI / 2;
			const cos = Math.cos(angle);
			const sin = Math.sin(angle);

			let mag = 3; // minimal dormant tick
			if (active) {
				const w1 = Math.sin(t * 3.1 + i * 0.7);
				const w2 = Math.cos(t * 2.3 - i * 0.4);
				const w3 = Math.sin(t * 5.2 + i * 1.5) * 0.5;
				const combined = Math.max(0, (w1 + w2 + w3 + 1.2) / 3.0);
				mag = 4 + combined * maxMagnitude;
			}

			const x1 = cx + r * cos;
			const y1 = cy + r * sin;
			const x2 = cx + (r + mag) * cos;
			const y2 = cy + (r + mag) * sin;

			ctx.moveTo(x1, y1);
			ctx.lineTo(x2, y2);
		}

		ctx.stroke();
		ctx.restore();
	}, [active, barColor, innerRadius, maxMagnitude, barCount]);

	useEffect(() => {
		let lastTime = performance.now();

		const loop = (time: number) => {
			const dt = (time - lastTime) / 1000;
			lastTime = time;

			if (active) {
				tickRef.current += dt * 4.5;
				draw();
				animIdRef.current = requestAnimationFrame(loop);
			} else {
				draw();
			}
		};

		draw();
		if (active) {
			animIdRef.current = requestAnimationFrame(loop);
		}

		return () => {
			if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
		};
	}, [active, draw]);

	return (
		<canvas
			ref={canvasRef}
			className={className}
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none"
			}}
		/>
	);
};
