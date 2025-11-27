import React, { useEffect, useRef, useState } from "react";
import { JSX } from "react/jsx-runtime";

type NotificationType = "success" | "error" | "info";

type NotificationItem = {
	id: number;
	message: string;
	type: NotificationType;
	duration?: number; // ms
};

export default function NotificationDemo(): JSX.Element {
	const [notifications, setNotifications] = useState<NotificationItem[]>([]);
	const nextId = useRef<number>(1);

	const addNotification = (message: string, type: NotificationType, duration = 4000) => {
		const id = nextId.current++;
		const item: NotificationItem = { id, message, type, duration };
		setNotifications((prev) => [item, ...prev]);
		// auto remove after duration
		setTimeout(() => removeNotification(id), duration);
	};

	const removeNotification = (id: number) => {
		setNotifications((prev) => prev.filter((n) => n.id !== id));
	};

	// demo helpers
	const demoSuccess = () => addNotification("Booking saved successfully.", "success");
	const demoError = () => addNotification("Failed to save booking. Please try again.", "error");
	const demoInfo = () => addNotification("New reservation from walk-in guest.", "info");

	// simple keyboard demo: press N to show an info notification
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key.toLowerCase() === "n") demoInfo();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	// basic inline styles so this component is self-contained
	const containerStyle: React.CSSProperties = {
		position: "fixed",
		right: 16,
		top: 16,
		zIndex: 9999,
		display: "flex",
		flexDirection: "column",
		gap: 8,
		maxWidth: 320,
	};

	const toastBase: React.CSSProperties = {
		padding: "10px 14px",
		borderRadius: 8,
		color: "#fff",
		boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		gap: 12,
		fontSize: 14,
	};

	const typeBg: Record<NotificationType, string> = {
		success: "#28a745",
		error: "#d73a49",
		info: "#2563eb",
	};

	return (
		<div>
			{/* Demo controls (place these where convenient during testing) */}
			<div style={{ padding: 12, display: "flex", gap: 8, alignItems: "center" }}>
				<button onClick={demoSuccess} style={{ padding: "8px 12px" }}>
					Show Success
				</button>
				<button onClick={demoError} style={{ padding: "8px 12px" }}>
					Show Error
				</button>
				<button onClick={demoInfo} style={{ padding: "8px 12px" }}>
					Show Info
				</button>
				<span style={{ color: "#666", marginLeft: 8, fontSize: 13 }}>Tip: press "N" to show Info</span>
			</div>

			{/* Toast container */}
			<div style={containerStyle} aria-live="polite" aria-atomic="true">
				{notifications.map((n) => (
					<div
						key={n.id}
						style={{
							...toastBase,
							background: typeBg[n.type],
						}}
					>
						<div style={{ flex: 1 }}>{n.message}</div>
						<button
							onClick={() => removeNotification(n.id)}
							aria-label="Dismiss notification"
							style={{
								background: "transparent",
								border: "none",
								color: "rgba(255,255,255,0.9)",
								cursor: "pointer",
								fontWeight: 600,
							}}
						>
							✕
						</button>
					</div>
				))}
			</div>
		</div>
	);
}
