import type { SVGProps } from "react";

/**
 * Nexora channel/icon set — inline SVGs modeled after Discord's iconic
 * channel glyphs so every surface speaks the same visual language.
 * All icons inherit `currentColor` and scale via font-size/class.
 */

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    viewBox: "0 0 24 24",
    "aria-hidden": true,
    focusable: false,
    ...props,
  } as const;
}

/** Rounded # used by text channels. */
export function IconHash(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M10 3.5 8.2 20.5" />
      <path d="M15.8 3.5 14 20.5" />
      <path d="M4.5 8.75h15.5" />
      <path d="M3.9 15.25h15.5" />
    </svg>
  );
}

/** Speaker with one sound wave — voice channels. */
export function IconVoice(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor">
      <path d="M11.38 4.47a1 1 0 0 1 1.62.78v13.5a1 1 0 0 1-1.62.78L6.35 15.5H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h2.35l5.03-4.03Z" />
      <path
        d="M16.2 8.4a1 1 0 0 1 1.4.2 6 6 0 0 1 0 6.8 1 1 0 1 1-1.63-1.16 4 4 0 0 0 0-4.48 1 1 0 0 1 .23-1.36Z"
        fillRule="evenodd"
      />
    </svg>
  );
}

/** Overlapping speech balloons — forum channels. */
export function IconForum(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor">
      <path d="M4 3.5h8.5A2.5 2.5 0 0 1 15 6v4a2.5 2.5 0 0 1-2.5 2.5H9L5.4 15.4A1 1 0 0 1 3.75 14.6V12.4A2.5 2.5 0 0 1 1.5 10V6A2.5 2.5 0 0 1 4 3.5Z" opacity={0.55} transform="translate(1 0)" />
      <path d="M9 8.5h8A2.5 2.5 0 0 1 19.5 11v3a2.5 2.5 0 0 1-2.5 2.5h-.4v2.9a.75.75 0 0 1-1.22.58L11.9 16.5H9A2.5 2.5 0 0 1 6.5 14v-3A2.5 2.5 0 0 1 9 8.5Z" />
    </svg>
  );
}

/** Megaphone — stage / announcement channels. */
export function IconMegaphone(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor">
      <path d="M19.4 3.3a1 1 0 0 1 .6.92v13.56a1 1 0 0 1-1.32.95L13 16.9l-1.02 3.4a2 2 0 0 1-1.91 1.43H9.3a1.6 1.6 0 0 1-1.53-2.05l1.06-3.53-5.42-1.72A1 1 0 0 1 2.7 13.5V8.83a1 1 0 0 1 .71-.96l15.3-4.66a1 1 0 0 1 .69.09ZM11 16.28l4 1.27v.01l-4-1.28Z" />
    </svg>
  );
}

/** Book — rules/guidelines channels. */
export function IconBook(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor">
      <path d="M6.5 2.5A3.5 3.5 0 0 0 3 6v12a3.5 3.5 0 0 0 3.5 3.5H19a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 19 5.5h-1V4A1.5 1.5 0 0 0 16.5 2.5h-10Zm.25 2h8.75v1H6.75a.5.5 0 0 1 0-1ZM6.5 17a1.5 1.5 0 0 1 1.5 1.5v.5H6.5A1.5 1.5 0 0 1 5 17.5h1.5Zm2.75-9.5h6.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5Zm0 3.5h6.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5Z" />
    </svg>
  );
}

/** Padlock — private channels. */
export function IconLock(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor">
      <path d="M12 2.5A4.5 4.5 0 0 0 7.5 7v2.5H7A2.5 2.5 0 0 0 4.5 12v7A2.5 2.5 0 0 0 7 21.5h10a2.5 2.5 0 0 0 2.5-2.5v-7A2.5 2.5 0 0 0 17 9.5h-.5V7A4.5 4.5 0 0 0 12 2.5Zm2.5 6.5h-5V7a2.5 2.5 0 0 1 5 0v2Z" />
    </svg>
  );
}

/** Boost-style gem. */
export function IconGem(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor">
      <path d="M7.2 3h9.6a1 1 0 0 1 .78.37l4.06 5.07a1 1 0 0 1-.04 1.3l-9.9 11.02a1 1 0 0 1-1.49 0L.4 9.74a1 1 0 0 1-.04-1.3l4.06-5.07A1 1 0 0 1 5.2 3h2Zm-1.7 2L3.1 8h3.4l1.6-3H5.5Zm5.06 0L9.06 8h5.88L13.44 5h-2.88Zm5.14 0 1.6 3h3.4L18.5 5h-2.8ZM2.9 10l7.35 8.18L8.1 10H2.9Zm7.23 0 1.87 8.4L13.87 10h-3.74Zm5.77 0-2.15 8.18L21.1 10h-5.2Z" />
    </svg>
  );
}
