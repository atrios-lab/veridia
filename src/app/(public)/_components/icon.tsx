// The redesign draws every icon as a stroked 24x24 path. That is a handful of
// path strings, so they live here instead of arriving as a dependency with a
// few thousand icons the site will never draw.
const PATHS = {
  menu: ["M4 7h16M4 12h16M4 17h16"],
  search: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z", "m20 20-3.5-3.5"],
  pencil: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"],
  calendar: [
    "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
    "M8 3v4M16 3v4M3 10h18",
  ],
  seal: ["M9 12.5 11 14.5 15 10", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z"],
  shield: ["M12 3 4 6v5c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6Z"],
  chat: ["M21 12a8 8 0 1 0-3 6.2L21 19l-.8-3A8 8 0 0 0 21 12Z"],
  columns: ["M4 20h16M6 20V9M10 20V9M14 20V9M18 20V9M3 9l9-5 9 5Z"],
  clock: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z", "M12 7v5l3 2"],
  external: [
    "M14 4h6v6",
    "M20 4 10 14",
    "M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5",
  ],
  arrowRight: ["M5 12h14M13 6l6 6-6 6"],
  arrowLeft: ["M19 12H5M11 18l-6-6 6-6"],
  chevronRight: ["m9 6 6 6-6 6"],
  check: ["m5 13 4 4L19 7"],
  download: ["M12 3v12M7 10l5 5 5-5", "M5 21h14"],
  plus: ["M12 5v14M5 12h14"],
  copy: [
    "M11 9h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z",
    "M5 15V5a2 2 0 0 1 2-2h10",
  ],
  alert: [
    "M12 9v4M12 17h.01",
    "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  ],
  info: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z", "M12 8v4M12 16h.01"],
  file: [
    "M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z",
    "M14 2v5h5",
  ],
  x: ["M18 6 6 18", "M6 6l12 12"],
  lock: [
    "M6 10h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z",
    "M8 10V7a4 4 0 0 1 8 0v3",
  ],
  thumbsUp: [
    "M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z",
    "M7 10l4-7a2 2 0 0 1 3 2l-1 5h5a2 2 0 0 1 2 2.4l-1.4 6A2 2 0 0 1 16.6 21H7Z",
  ],
  bulb: [
    "M9 18h6M10 21h4",
    "M12 3a6 6 0 0 0-3.5 10.9V15h7v-1.1A6 6 0 0 0 12 3Z",
  ],
  phone: [
    "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z",
  ],
  send: ["M22 2 11 13M22 2l-7 20-4-9-9-4z"],
  paperclip: [
    "M21.4 11.1 12 20.5a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.5 3.5 0 0 1 5 4.9l-8.5 8.5a1.5 1.5 0 0 1-2.1-2.1l7.8-7.8",
  ],
  star: [
    "m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9-6.2-3.2-6.2 3.2 1.2-6.9-5-4.9 6.9-1Z",
  ],
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  className,
  strokeWidth = 1.8,
}: {
  name: IconName;
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
