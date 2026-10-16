import { Volume2, Sun, ArrowLeftToLine, ArrowRightToLine, Layers } from "lucide-react";
import { SettingRow } from "./SettingRow";

interface OverlaysTabProps {
	volumeOverlayEnabled: boolean;
	toggleVolumeOverlay: () => void;
	volumeEdgeEnabled: boolean;
	toggleVolumeEdge: () => void;
	brightnessOverlayEnabled: boolean;
	toggleBrightnessOverlay: () => void;
	brightnessEdgeEnabled: boolean;
	toggleBrightnessEdge: () => void;
	altTab3dEnabled: boolean;
	toggleAltTab3d: () => void;
}

export function OverlaysTab({
	volumeOverlayEnabled,
	toggleVolumeOverlay,
	volumeEdgeEnabled,
	toggleVolumeEdge,
	brightnessOverlayEnabled,
	toggleBrightnessOverlay,
	brightnessEdgeEnabled,
	toggleBrightnessEdge,
	altTab3dEnabled,
	toggleAltTab3d
}: OverlaysTabProps) {
	return (
		<>
			<div className="setting-group-label">Overlays</div>
			<div className="setting-group">
				<SettingRow icon={Volume2} label="Volume HUD" desc="Bloom volume overlay">
					<label className="toggle-switch">
						<input type="checkbox" checked={volumeOverlayEnabled} onChange={toggleVolumeOverlay} />
						<span className="slider"></span>
					</label>
				</SettingRow>

				{volumeOverlayEnabled && (
					<SettingRow
						icon={ArrowLeftToLine}
						label="Show on Edge Hover"
						desc="Slide in from left edge"
					>
						<label className="toggle-switch">
							<input type="checkbox" checked={volumeEdgeEnabled} onChange={toggleVolumeEdge} />
							<span className="slider"></span>
						</label>
					</SettingRow>
				)}

				<SettingRow icon={Sun} label="Brightness HUD" desc="Bloom brightness overlay">
					<label className="toggle-switch">
						<input
							type="checkbox"
							checked={brightnessOverlayEnabled}
							onChange={toggleBrightnessOverlay}
						/>
						<span className="slider"></span>
					</label>
				</SettingRow>

				{brightnessOverlayEnabled && (
					<SettingRow
						icon={ArrowRightToLine}
						label="Show on Edge Hover"
						desc="Slide in from right edge"
						divider={false}
					>
						<label className="toggle-switch">
							<input
								type="checkbox"
								checked={brightnessEdgeEnabled}
								onChange={toggleBrightnessEdge}
							/>
							<span className="slider"></span>
						</label>
					</SettingRow>
				)}
			</div>

			<div className="setting-group-label">Window Switcher</div>
			<div className="setting-group">
				<SettingRow
					icon={Layers}
					label="3D Alt+Tab (Flip3D / Coverflow)"
					desc="Linux/Compiz style 3D carousel window switcher with live previews and reflections"
					divider={false}
				>
					<label className="toggle-switch">
						<input
							type="checkbox"
							checked={altTab3dEnabled}
							onChange={toggleAltTab3d}
						/>
						<span className="slider"></span>
					</label>
				</SettingRow>
			</div>
		</>
	);
}
