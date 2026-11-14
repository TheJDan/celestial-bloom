import { useState } from "react";

export interface Announcement {
	id: string;
	severity: "info" | "warning";
	title: string;
	body: string;
	url?: string;
}

export function useAnnouncement(): { announcement: Announcement | null; dismissed: boolean; dismiss: () => void } {
	const [announcement] = useState<Announcement | null>(null);
	const [dismissed] = useState(true);
	const dismiss = () => {};
	return { announcement, dismissed, dismiss };
}
