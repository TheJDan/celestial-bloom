import { Palette, Droplet, Contrast, Droplets, Sun, Square, Maximize2, Sparkles } from "lucide-react";
import { SettingRow } from "./SettingRow";

interface AppearanceTabProps {
	themeMode: string;
	handleThemeModeChange: (mode: string) => void;
	themeColor: string;
	handleThemeColorChange: (color: string) => void;
	themeOpacity: number;
	handleOpacityChange: (val: number) => void;
	themeSaturation: number;
	handleSaturationChange: (val: number) => void;
	themeBrightness: number;
	handleBrightnessChange: (val: number) => void;
	cornersEnabled: boolean;
	toggleCorners: () => void;
	edgeShineEnabled: boolean;
	toggleEdgeShine: () => void;
	scale: number;
	handleScaleChange: (val: number) => void;
	dockScale?: number;
	handleDockScaleChange?: (val: number) => void;
	notchScale?: number;
	handleNotchScaleChange?: (val: number) => void;
}

export function AppearanceTab({
	themeMode,
	handleThemeModeChange,
	themeColor,
	handleThemeColorChange,
	themeOpacity,
	handleOpacityChange,
	themeSaturation,
	handleSaturationChange,
	themeBrightness,
	handleBrightnessChange,
	cornersEnabled,
	toggleCorners,
	edgeShineEnabled,
	toggleEdgeShine,
	scale,
	handleScaleChange,
	dockScale,
	handleDockScaleChange,
	notchScale,
	handleNotchScaleChange
}: AppearanceTabProps) {
	const showCustomColor = themeMode === "custom";
	const showAdvancedSliders = themeMode === "custom" || themeMode === "adaptive";

	return (
		<>
			<div className="setting-group-label">Theme</div>
			<div className="setting-group">
				<SettingRow icon={Palette} label="Theme Mode" desc="Configure visual styling">
					<select
						className="settings-select"
						value={themeMode}
						onChange={(e) => handleThemeModeChange(e.target.value)}
					>
						<option value="dark">Dark (Translucent)</option>
						<option value="light">Light (Translucent)</option>
						<option value="custom">Custom Color</option>
						<option value="adaptive">Adaptive Accent</option>
					</select>
				</SettingRow>

				{showCustomColor && (
					<SettingRow
						icon={Droplet}
						label="Custom Theme Color"
						desc="Choose layout background color"
					>
						<div className="color-picker-row">
							<input
								type="color"
								value={themeColor}
								onChange={(e) => handleThemeColorChange(e.target.value)}
								className="color-picker-input"
							/>
							<span className="color-picker-label">{themeColor.toUpperCase()}</span>
						</div>
					</SettingRow>
				)}

				<SettingRow
					icon={Contrast}
					label="Background Opacity"
					desc={`Adjust theme transparency (${Math.round(themeOpacity * 100)}%)`}
					divider={showAdvancedSliders}
				>
					<input
						type="range"
						min="0.1"
						max="1.0"
						step="0.05"
						value={themeOpacity}
						onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
						className="settings-slider"
					/>
				</SettingRow>

				{showAdvancedSliders && (
					<>
						<SettingRow
							icon={Droplets}
							label="Color Saturation"
							desc={`Adjust theme color vibrancy (${Math.round(themeSaturation * 100)}%)`}
						>
							<input
								type="range"
								min="0.0"
								max="1.0"
								step="0.02"
								value={themeSaturation}
								onChange={(e) => handleSaturationChange(parseFloat(e.target.value))}
								className="settings-slider"
							/>
						</SettingRow>

						<SettingRow
							icon={Sun}
							label="Background Brightness"
							desc={`Adjust background lightness (${Math.round(themeBrightness * 100)}%)`}
							divider={false}
						>
							<input
								type="range"
								min="0.0"
								max="1.0"
								step="0.02"
								value={themeBrightness}
								onChange={(e) => handleBrightnessChange(parseFloat(e.target.value))}
								className="settings-slider"
							/>
						</SettingRow>
					</>
				)}
			</div>

			<div className="setting-group-label">Display</div>
			<div className="setting-group">
				<SettingRow icon={Sparkles} label="Edge shine" desc="Soft reflections around the dock and notch">
					<label className="toggle-switch">
						<input type="checkbox" aria-label="Edge shine" checked={edgeShineEnabled} onChange={toggleEdgeShine} />
						<span className="slider"></span>
					</label>
				</SettingRow>
				<SettingRow icon={Square} label="Screen Corners" desc="Rounded top edges">
					<label className="toggle-switch">
						<input type="checkbox" checked={cornersEnabled} onChange={toggleCorners} />
						<span className="slider"></span>
					</label>
				</SettingRow>

				<SettingRow
					icon={Maximize2}
					label="Dock Scale (Taskbar)"
					desc={`Adjust taskbar size independently (${Math.round((dockScale ?? scale) * 100)}%)`}
					divider={true}
				>
					<div className="scale-button-container">
						<button
							onClick={() => {
								const current = dockScale ?? scale;
								const next = Math.max(0.6, parseFloat((current - 0.1).toFixed(1)));
								(handleDockScaleChange ?? handleScaleChange)(next);
							}}
							disabled={(dockScale ?? scale) <= 0.6}
							className="scale-adjust-btn"
							title="Make Dock Smaller"
						>
							—
						</button>
						<span className="scale-display-value">{Math.round((dockScale ?? scale) * 100)}%</span>
						<button
							onClick={() => {
								const current = dockScale ?? scale;
								const next = Math.min(1.3, parseFloat((current + 0.1).toFixed(1)));
								(handleDockScaleChange ?? handleScaleChange)(next);
							}}
							disabled={(dockScale ?? scale) >= 1.3}
							className="scale-adjust-btn"
							title="Make Dock Larger"
						>
							+
						</button>
					</div>
				</SettingRow>

				<SettingRow
					icon={Maximize2}
					label="Notch Scale (Island)"
					desc={`Adjust top floating notch size independently (${Math.round((notchScale ?? scale) * 100)}%)`}
					divider={false}
				>
					<div className="scale-button-container">
						<button
							onClick={() => {
								const current = notchScale ?? scale;
								const next = Math.max(0.8, parseFloat((current - 0.1).toFixed(1)));
								(handleNotchScaleChange ?? handleScaleChange)(next);
							}}
							disabled={(notchScale ?? scale) <= 0.8}
							className="scale-adjust-btn"
							title="Make Notch Smaller"
						>
							—
						</button>
						<span className="scale-display-value">{Math.round((notchScale ?? scale) * 100)}%</span>
						<button
							onClick={() => {
								const current = notchScale ?? scale;
								const next = Math.min(1.5, parseFloat((current + 0.1).toFixed(1)));
								(handleNotchScaleChange ?? handleScaleChange)(next);
							}}
							disabled={(notchScale ?? scale) >= 1.5}
							className="scale-adjust-btn"
							title="Make Notch Larger"
						>
							+
						</button>
					</div>
				</SettingRow>
			</div>
		</>
	);
}
