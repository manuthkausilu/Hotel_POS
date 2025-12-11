import React, { useState } from 'react';

type OrderItem = {
	id: string;
	name: string;
	qty: number;
	price: number;
};

type Order = {
	id: string;
	table: string;
	items: OrderItem[];
	status: 'NotReady' | 'Ready';
	time: string;
	total: number;
};

const sampleOrders: Order[] = [
	{
		id: 'ORD-1001',
		table: 'Table 5',
		items: [
			{ id: 'i1', name: 'Margherita Pizza', qty: 1, price: 8.5 },
			{ id: 'i2', name: 'Caesar Salad', qty: 2, price: 4.0 },
		],
		status: 'NotReady',
		time: '12:05',
		total: 16.5,
	},
	{
		id: 'ORD-1002',
		table: 'Table 2',
		items: [
			{ id: 'i3', name: 'Beef Burger', qty: 1, price: 6.75 },
			{ id: 'i4', name: 'Fries', qty: 1, price: 2.5 },
			{ id: 'i5', name: 'Coke', qty: 2, price: 1.25 },
		],
		status: 'NotReady',
		time: '12:10',
		total: 11.75,
	},
	{
		id: 'ORD-1003',
		table: 'Takeaway',
		items: [
			{ id: 'i6', name: 'Pad Thai', qty: 1, price: 9.0 },
		],
		status: 'Ready',
		time: '12:12',
		total: 9.0,
	},
];

export default function OngoingOrder(): JSX.Element {
	const [isOpen, setIsOpen] = useState(false);
	const [orders, setOrders] = useState<Order[]>(sampleOrders);

	const closeDrawer = () => setIsOpen(false);
	const openDrawer = () => setIsOpen(true);

	const markComplete = (id: string) => {
		// small UI stub: update status to Completed
		setOrders(prev =>
			prev.map(o => (o.id === id ? { ...o, status: 'Ready' } : o))
		);
	};

	return (
		<>
			{/* Trigger button */}
			<button
				onClick={openDrawer}
				style={{
					padding: '10px 14px',
					borderRadius: 6,
					border: 'none',
					background: '#2b6cb0',
					color: 'white',
					cursor: 'pointer',
				}}
			>
				Open Ongoing Orders
			</button>

			{/* Overlay */}
			{isOpen && (
				<div
					onClick={closeDrawer}
					style={{
						position: 'fixed',
						inset: 0,
						background: 'rgba(0,0,0,0.4)',
						zIndex: 999,
					}}
				/>
			)}

			{/* Drawer */}
			<div
				style={{
					position: 'fixed',
					top: 0,
					right: 0,
					height: '100vh',
					width: 360,
					maxWidth: '100%',
					background: '#fff',
					boxShadow: '-8px 0 24px rgba(0,0,0,0.12)',
					transform: isOpen ? 'translateX(0)' : 'translateX(110%)',
					transition: 'transform 250ms ease',
					zIndex: 1000,
					display: 'flex',
					flexDirection: 'column',
				}}
				aria-hidden={!isOpen}
			>
				{/* Header */}
				<div
					style={{
						padding: '16px 18px',
						borderBottom: '1px solid #eee',
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
					}}
				>
					<h3 style={{ margin: 0, fontSize: 16 }}>Ongoing Orders</h3>
					<button
						onClick={closeDrawer}
						style={{
							background: 'transparent',
							border: 'none',
							fontSize: 18,
							cursor: 'pointer',
						}}
						aria-label="Close drawer"
					>
						×
					</button>
				</div>

				{/* Content */}
				<div
					style={{
						padding: 16,
						overflowY: 'auto',
						flex: 1,
					}}
				>
					{orders.length === 0 ? (
						<div style={{ color: '#666' }}>No ongoing orders</div>
					) : (
						orders.map(order => (
							<div
								key={order.id}
								style={{
									border: '1px solid #f0f0f0',
									padding: 12,
									borderRadius: 8,
									marginBottom: 12,
								}}
							>
								<div
									style={{
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'center',
										marginBottom: 8,
									}}
								>
									<div>
										<div style={{ fontWeight: 600 }}>{order.id}</div>
										<div style={{ fontSize: 12, color: '#666' }}>{order.table} • {order.time}</div>
									</div>
									<div style={{ textAlign: 'right' }}>
										<div
											style={{
												padding: '4px 8px',
												borderRadius: 12,
												fontSize: 12,
												background:
													order.status === 'Completed' ? '#e6fffa' :
													order.status === 'Served' ? '#fff7ed' :
													order.status === 'Cooking' ? '#fff1f2' : '#ebf8ff',
												color:
													order.status === 'Completed' ? '#03543f' :
													order.status === 'Served' ? '#92400e' :
													order.status === 'Cooking' ? '#9f1239' : '#1e3a8a',
											}}
										>
											{order.status}
										</div>
										<div style={{ fontWeight: 700, marginTop: 6 }}>${order.total.toFixed(2)}</div>
									</div>
								</div>

								{/* items */}
								<ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
									{order.items.map(it => (
										<li
											key={it.id}
											style={{
												display: 'flex',
												justifyContent: 'space-between',
												padding: '6px 0',
												borderTop: '1px dashed #f3f3f3',
											}}
										>
											<span style={{ color: '#333' }}>{it.qty} x {it.name}</span>
											<span style={{ color: '#333' }}>${(it.price * it.qty).toFixed(2)}</span>
										</li>
									))}
								</ul>

								{/* Actions */}
								<div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
									<button
										onClick={() => markComplete(order.id)}
										style={{
											flex: 1,
											padding: '8px 10px',
											borderRadius: 6,
											border: '1px solid #e2e8f0',
											background: '#f7fafc',
											cursor: 'pointer',
										}}
									>
										Mark Complete
									</button>
									<button
										onClick={() => {
											// quick focus action: maybe navigate to detail — stub
										}}
										style={{
											flex: 1,
											padding: '8px 10px',
											borderRadius: 6,
											border: 'none',
											background: '#2b6cb0',
											color: '#fff',
											cursor: 'pointer',
										}}
									>
										View
									</button>
								</div>
							</div>
						))
					)}
				</div>

				{/* Footer */}
				<div style={{ padding: 12, borderTop: '1px solid #eee' }}>
					<button
						onClick={closeDrawer}
						style={{
							width: '100%',
							padding: '10px 12px',
							borderRadius: 6,
							border: 'none',
							background: '#e2e8f0',
							cursor: 'pointer',
						}}
					>
						Close
					</button>
				</div>
			</div>
		</>
	);
}
