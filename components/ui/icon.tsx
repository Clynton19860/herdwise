import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const wrap = ({ size = 18, strokeWidth = 1.6, ...rest }: IconProps) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...rest,
});

export const I = {
  Cow: (p: IconProps) => (
    <svg {...wrap(p)}>
      <path d="M4 11c0-3 2-5 5-5h6c3 0 5 2 5 5v3a5 5 0 0 1-5 5h-6a5 5 0 0 1-5-5v-3Z" />
      <path d="M7 6 5 3M17 6l2-3" />
      <circle cx="9.5" cy="12" r="0.8" fill="currentColor" />
      <circle cx="14.5" cy="12" r="0.8" fill="currentColor" />
      <path d="M10 16h4" />
    </svg>
  ),
  Map: (p: IconProps) => (
    <svg {...wrap(p)}>
      <path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z" />
      <path d="M9 4v16M15 6v16" />
    </svg>
  ),
  Pin: (p: IconProps) => (
    <svg {...wrap(p)}>
      <path d="M12 22s7-7.6 7-13a7 7 0 1 0-14 0c0 5.4 7 13 7 13Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  Shield: (p: IconProps) => (
    <svg {...wrap(p)}>
      <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  Heart: (p: IconProps) => (
    <svg {...wrap(p)}>
      <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6C19 16.5 12 21 12 21Z" />
    </svg>
  ),
  Bell: (p: IconProps) => (
    <svg {...wrap(p)}>
      <path d="M6 8a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  ),
  Search: (p: IconProps) => (
    <svg {...wrap(p)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  ArrowRight: (p: IconProps) => (
    <svg {...wrap(p)}>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  ),
  ArrowUp: (p: IconProps) => (
    <svg {...wrap(p)}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  ),
  ArrowDown: (p: IconProps) => (
    <svg {...wrap(p)}>
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  ),
  Sparkle: (p: IconProps) => (
    <svg {...wrap(p)}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
    </svg>
  ),
  Activity: (p: IconProps) => (
    <svg {...wrap(p)}>
      <path d="M3 12h4l2-6 4 12 2-6h6" />
    </svg>
  ),
  Layers: (p: IconProps) => (
    <svg {...wrap(p)}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5M3 18l9 5 9-5" />
    </svg>
  ),
  Users: (p: IconProps) => (
    <svg {...wrap(p)}>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7" />
      <circle cx="17" cy="6" r="3" />
      <path d="M22 18c0-2.8-2.2-5-5-5" />
    </svg>
  ),
  Gauge: (p: IconProps) => (
    <svg {...wrap(p)}>
      <path d="M12 13V8" />
      <circle cx="12" cy="13" r="9" />
      <path d="M4.2 17.5A9 9 0 1 1 19.8 17.5" />
    </svg>
  ),
  Wifi: (p: IconProps) => (
    <svg {...wrap(p)}>
      <path d="M2 9a16 16 0 0 1 20 0" />
      <path d="M5 13a11 11 0 0 1 14 0" />
      <path d="M8.5 16.5a6 6 0 0 1 7 0" />
      <circle cx="12" cy="20" r="1" fill="currentColor" />
    </svg>
  ),
  Battery: (p: IconProps) => (
    <svg {...wrap(p)}>
      <rect x="2" y="8" width="18" height="8" rx="2" />
      <rect x="4" y="10" width="10" height="4" rx="1" fill="currentColor" />
      <path d="M22 11v2" />
    </svg>
  ),
  Plus: (p: IconProps) => (
    <svg {...wrap(p)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Filter: (p: IconProps) => (
    <svg {...wrap(p)}>
      <path d="M3 5h18l-7 9v5l-4 2v-7L3 5Z" />
    </svg>
  ),
  Chevron: (p: IconProps) => (
    <svg {...wrap(p)}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  ),
  Dashboard: (p: IconProps) => (
    <svg {...wrap(p)}>
      <rect x="3" y="3" width="8" height="10" rx="2" />
      <rect x="13" y="3" width="8" height="6" rx="2" />
      <rect x="13" y="11" width="8" height="10" rx="2" />
      <rect x="3" y="15" width="8" height="6" rx="2" />
    </svg>
  ),
  Stethoscope: (p: IconProps) => (
    <svg {...wrap(p)}>
      <path d="M5 3v6a4 4 0 0 0 8 0V3" />
      <path d="M9 13v3a5 5 0 0 0 10 0v-2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  ),
  Alert: (p: IconProps) => (
    <svg {...wrap(p)}>
      <path d="M12 3 2 21h20L12 3Z" />
      <path d="M12 10v5M12 18h.01" />
    </svg>
  ),
  Settings: (p: IconProps) => (
    <svg {...wrap(p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.4 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.4l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.6 7l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  ),
  Logout: (p: IconProps) => (
    <svg {...wrap(p)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </svg>
  ),
  Tag: (p: IconProps) => (
    <svg {...wrap(p)}>
      <path d="M20 12 12 20l-9-9V3h8l9 9Z" />
      <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" />
    </svg>
  ),
  Calendar: (p: IconProps) => (
    <svg {...wrap(p)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  Eye: (p: IconProps) => (
    <svg {...wrap(p)}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Check: (p: IconProps) => (
    <svg {...wrap(p)}>
      <path d="m5 12 5 5L20 7" />
    </svg>
  ),
  Globe: (p: IconProps) => (
    <svg {...wrap(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  ),
  Menu: (p: IconProps) => (
    <svg {...wrap(p)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
  X: (p: IconProps) => (
    <svg {...wrap(p)}>
      <path d="M6 6 18 18M18 6 6 18" />
    </svg>
  ),
};
