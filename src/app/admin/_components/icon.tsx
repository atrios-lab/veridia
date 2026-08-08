// Private to the admin route group, same idea as (public)/_components/icon.tsx
// but its own small set: the panel never shares components with the public
// site, on purpose, so the two can change independently.
const PATHS = {
  eye: [
    "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z",
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  ],
  eyeOff: [
    "M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-2.16 3.19M6.1 6.1C3.3 7.9 2 11 2 11s3.5 7 10 7a9.3 9.3 0 0 0 5.05-1.5",
    "M9.5 9.5a3 3 0 0 0 4.24 4.24",
    "M2 2l20 20",
  ],
  check: ["m5 13 4 4L19 7"],
  clock: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z", "M12 7v5l3 2"],
  // Sidebar navigation. The rounded rectangles are written as paths rather
  // than <rect> so every icon in this set is the same one-shape-per-string
  // list.
  grid: [
    "M4.5 3h4A1.5 1.5 0 0 1 10 4.5v6A1.5 1.5 0 0 1 8.5 12h-4A1.5 1.5 0 0 1 3 10.5v-6A1.5 1.5 0 0 1 4.5 3Z",
    "M15.5 3h4A1.5 1.5 0 0 1 21 4.5v2A1.5 1.5 0 0 1 19.5 8h-4A1.5 1.5 0 0 1 14 6.5v-2A1.5 1.5 0 0 1 15.5 3Z",
    "M15.5 12h4a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-6a1.5 1.5 0 0 1 1.5-1.5Z",
    "M4.5 16h4A1.5 1.5 0 0 1 10 17.5v2A1.5 1.5 0 0 1 8.5 21h-4A1.5 1.5 0 0 1 3 19.5v-2A1.5 1.5 0 0 1 4.5 16Z",
  ],
  settings: [
    "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
    "M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1",
  ],
  lock: [
    "M6 10h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z",
    "M8 10V7a4 4 0 0 1 8 0v3",
  ],
  upload: [
    "M12 16V4M12 4 7 9M12 4l5 5",
    "M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3",
  ],
  chevronDown: ["m6 9 6 6 6-6"],
  // Sidebar navigation: the service request queue.
  inbox: [
    "M4 12h4l2 3h4l2-3h4",
    "M4 12 5.5 5A2 2 0 0 1 7.4 3.5h9.2A2 2 0 0 1 18.5 5L20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6Z",
  ],
  // Sidebar navigation: publications (a folded document with two lines).
  file: [
    "M4 22V4a2 2 0 0 1 2-2h9l5 5v15a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2Z",
    "M14 2v6h6",
    "M8 13h8",
    "M8 17h5",
  ],
  // Sidebar navigation and header indicator: support chat (a speech bubble).
  chat: ["M7.9 20A9 9 0 1 0 4 16.1L2 22Z"],
  x: ["M18 6 6 18", "M6 6l12 12"],
  // Sidebar navigation: the appointment queue.
  calendar: [
    "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  ],
  // Sidebar navigation: the ombudsman queue.
  megaphone: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  // Sidebar navigation: the data rights (LGPD) queue.
  shield: [
    "M5.5 10h13A1.5 1.5 0 0 1 20 11.5v8A1.5 1.5 0 0 1 18.5 21h-13A1.5 1.5 0 0 1 4 19.5v-8A1.5 1.5 0 0 1 5.5 10Z",
    "M8 10V7a4 4 0 0 1 8 0v3",
  ],
  // Sidebar navigation: the Usuários screen.
  users: [
    "M2 21v-1.5A4.5 4.5 0 0 1 6.5 15h4a4.5 4.5 0 0 1 4.5 4.5V21",
    "M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    "M16 6.2a4 4 0 0 1 0 7.6",
    "M22 21v-1.5a4.5 4.5 0 0 0-3.2-4.3",
  ],
} as const;

export type AdminIconName = keyof typeof PATHS;

export function AdminIcon({
  name,
  className,
  strokeWidth = 1.8,
}: {
  name: AdminIconName;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
