import React, { useState } from "react";
import { Camera, Bell, Check } from "lucide-react";
import { CaelestiaTopBar, CaelestiaTabKey } from "./CaelestiaTopBar";
import "./CaelestiaTabs.css";

interface NotificationItem {
	id: string;
	title: string;
	time: string;
	subtitle: string;
	isNew: boolean;
}

interface NotificationGroup {
	appId: string;
	appName: string;
	icon: React.ReactNode;
	items: NotificationItem[];
}

interface CaelestiaNotificationsTabProps {
	onSwitchTab?: (tab: CaelestiaTabKey) => void;
}

export function CaelestiaNotificationsTab({ onSwitchTab }: CaelestiaNotificationsTabProps) {
	const [groups, setGroups] = useState<NotificationGroup[]>([
		{
			appId: "screenshot",
			appName: "Screenshot",
			icon: <Camera size={14} color="rgba(255, 255, 255, 0.7)" />,
			items: [
				{
					id: "notif-1",
					title: "Screenshot Captured",
					time: "ahora",
					subtitle: "Saved to /home/Dan/Pictures/Screenshots/screenshot-2026-1...",
					isNew: true
				},
				{
					id: "notif-2",
					title: "Screenshot Captured",
					time: "ahora",
					subtitle: "Saved to /home/Dan/Pictures/Screenshots/screenshot-2026-1...",
					isNew: true
				}
			]
		}
	]);

	const totalNew = groups.reduce((acc, g) => acc + g.items.filter((i) => i.isNew).length, 0);

	const handleClearAll = () => {
		setGroups([]);
	};

	return (
		<div className="caelestia-home-panel cnotif-tab-root" onClick={(e) => e.stopPropagation()}>
			{/* Top Bar */}
			<CaelestiaTopBar
				activeTab="notifications"
				onSwitchTab={(t) => onSwitchTab?.(t)}
				notificationCount={totalNew}
			/>

			{/* Notifications Content (Image 7) */}
			<div className="cnotif-layout">
				{groups.length > 0 ? (
					<>
						{/* Header row */}
						<div className="cnotif-header-row">
							<div className="cnotif-header-title-wrap">
								<span className="cnotif-title-main">Notificaciones</span>
								<span className="cnotif-title-count">{totalNew} nuevas</span>
							</div>
							<button type="button" className="cnotif-clear-btn" onClick={handleClearAll}>
								Borrar todo
							</button>
						</div>

						{/* Grouped cards */}
						<div className="cnotif-cards-grid">
							{groups.map((grp) => (
								<div key={grp.appId} className="cnotif-group-card">
									{/* App header in card */}
									<div className="cnotif-card-head">
										<div className="cnotif-card-app-info">
											{grp.icon}
											<span className="cnotif-card-app-name">{grp.appName}</span>
										</div>
										<span className="cnotif-card-badge">{grp.items.length}</span>
									</div>

									{/* List of notification rows */}
									<div className="cnotif-items-list">
										{grp.items.map((item) => (
											<div key={item.id} className="cnotif-item-row">
												<div className="cnotif-bullet-wrap">
													{item.isNew && <span className="cnotif-orange-dot" />}
												</div>
												<div className="cnotif-item-body">
													<div className="cnotif-item-headline">
														<span className="cnotif-item-title">{item.title}</span>
														<span className="cnotif-item-time">{item.time}</span>
													</div>
													<div className="cnotif-item-sub">{item.subtitle}</div>
												</div>
											</div>
										))}
									</div>
								</div>
							))}
						</div>
					</>
				) : (
					<div className="cnotif-empty-state">
						<Bell size={32} color="rgba(255, 255, 255, 0.2)" />
						<div className="cnotif-empty-title">Sin notificaciones</div>
						<div className="cnotif-empty-sub">Las nuevas se guardarán aquí.</div>
					</div>
				)}
			</div>
		</div>
	);
}
