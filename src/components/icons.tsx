import type { SVGProps } from "react";

/** A small line-icon set, 24px grid, stroke-based so it follows the text colour. */
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

type P = SVGProps<SVGSVGElement>;

export const PlusCircle = (p: P) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></Icon>
);
export const Inbox = (p: P) => (
  <Icon {...p}><path d="M4 13l2.2-7.1A2 2 0 0 1 8.1 4.5h7.8a2 2 0 0 1 1.9 1.4L20 13" /><path d="M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5h-4.5l-1.5 2.5h-4L8.5 13z" /></Icon>
);
export const Queue = (p: P) => (
  <Icon {...p}><rect x="3.5" y="4" width="17" height="16" rx="2.5" /><path d="M8 9h8M8 13h8M8 17h5" /></Icon>
);
export const CheckSquare = (p: P) => (
  <Icon {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><path d="M8.5 12.5l2.5 2.5 5-5.5" /></Icon>
);
export const Settings = (p: P) => (
  <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></Icon>
);
export const Menu = (p: P) => (
  <Icon {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Icon>
);
export const Close = (p: P) => (
  <Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>
);
export const LogOut = (p: P) => (
  <Icon {...p}><path d="M15 17l5-5-5-5M20 12H9" /><path d="M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6" /></Icon>
);
export const ChevronRight = (p: P) => (
  <Icon {...p}><path d="M9 6l6 6-6 6" /></Icon>
);
export const ChevronUpDown = (p: P) => (
  <Icon {...p}><path d="M8 9l4-4 4 4M8 15l4 4 4-4" /></Icon>
);
export const ArrowLeft = (p: P) => (
  <Icon {...p}><path d="M19 12H5M11 18l-6-6 6-6" /></Icon>
);
export const Check = (p: P) => (
  <Icon {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Icon>
);
export const Paperclip = (p: P) => (
  <Icon {...p}><path d="M20.5 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" /></Icon>
);
export const Upload = (p: P) => (
  <Icon {...p}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></Icon>
);
export const Shield = (p: P) => (
  <Icon {...p}><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z" /><path d="M9 12l2 2 4-4.5" /></Icon>
);
export const Plane = (p: P) => (
  <Icon {...p}><path d="M10.5 13.5L4 11l1.5-1.5 7 1 4-4.5c1-1 2.6-1.3 3.4-.5.8.8.5 2.4-.5 3.4l-4.5 4 1 7L14.5 21 12 14.5l-3 3v2.5L7.5 21 6 18l-3-1.5L4.5 15H7l3-3" /></Icon>
);
export const Wrench = (p: P) => (
  <Icon {...p}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L4 16.8V20h3.2l5.3-5.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z" /></Icon>
);
export const Users = (p: P) => (
  <Icon {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></Icon>
);
export const Alert = (p: P) => (
  <Icon {...p}><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17.5v.01" /></Icon>
);
export const Moon = (p: P) => (
  <Icon {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></Icon>
);
export const Clock = (p: P) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>
);
export const FileText = (p: P) => (
  <Icon {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></Icon>
);
export const Search = (p: P) => (
  <Icon {...p}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></Icon>
);
export const Download = (p: P) => (
  <Icon {...p}><path d="M12 4v12M7 11l5 5 5-5" /><path d="M4 18v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1" /></Icon>
);
export const Bell = (p: P) => (
  <Icon {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" /></Icon>
);
