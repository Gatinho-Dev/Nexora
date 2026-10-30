/**
 * Nexora Bots UI - Design Tokens
 * Centralized design system for the bot management interface
 */

export const colors = {
  // Brand colors
  primary: {
    50: '#eef0fb',
    100: '#dce0f7',
    200: '#bcc0ef',
    300: '#999ce5',
    400: '#7678db',
    500: '#5865f2', // Main Discord blurple
    600: '#4752c4',
    700: '#3a42a0',
    800: '#30357d',
    900: '#292d63',
    950: '#1d1d45',
  },

  // Semantic colors
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#3ba55c', // Main success green
    600: '#22c55e',
    700: '#16a34a',
    800: '#15803d',
    900: '#166534',
  },

  danger: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ed4245', // Main danger red
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },

  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#faa61a', // Main warning amber
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },

  // Node category colors
  node: {
    trigger: {
      bg: 'rgba(59, 165, 92, 0.12)',
      border: '#3ba55c',
      text: '#3ba55c',
      handle: '#3ba55c',
      hover: 'rgba(59, 165, 92, 0.2)',
    },
    action: {
      bg: 'rgba(88, 101, 242, 0.12)',
      border: '#5865f2',
      text: '#5865f2',
      handle: '#5865f2',
      hover: 'rgba(88, 101, 242, 0.2)',
    },
    logic: {
      bg: 'rgba(250, 166, 26, 0.12)',
      border: '#faa61a',
      text: '#faa61a',
      handle: '#faa61a',
      hover: 'rgba(250, 166, 26, 0.2)',
    },
  },

  // Neutral/Dark mode first
  neutral: {
    0: '#ffffff',
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },

  // Background surfaces (dark mode)
  surface: {
    primary: '#1e1f22',      // Main background
    secondary: '#25272b',    // Cards, modals
    tertiary: '#2f3136',     // Elevated surfaces
    hover: '#36393f',        // Hover states
    active: '#3e4147',       // Active/pressed
    border: '#3e4147',       // Borders
    borderStrong: '#4f545c', // Strong borders
  },

  // Text colors (dark mode)
  text: {
    primary: '#ffffff',
    secondary: '#b9bbbe',
    tertiary: '#8e9297',
    inverse: '#1e1f22',
    link: '#5865f2',
    linkHover: '#7678db',
  },

  // Status colors
  status: {
    enabled: '#3ba55c',
    disabled: '#8e9297',
    pending: '#faa61a',
    error: '#ed4245',
  },

  // Focus ring
  focus: {
    ring: 'rgba(88, 101, 242, 0.4)',
    ringOffset: '#1e1f22',
  },
} as const;

export const spacing = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  7: '1.75rem',   // 28px
  8: '2rem',      // 32px
  9: '2.25rem',   // 36px
  10: '2.5rem',   // 40px
  11: '2.75rem',  // 44px
  12: '3rem',     // 48px
  14: '3.5rem',   // 56px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem',     // 96px
} as const;

export const borderRadius = {
  none: '0',
  sm: '0.25rem',   // 4px
  md: '0.375rem',  // 6px
  lg: '0.5rem',    // 8px
  xl: '0.75rem',   // 12px
  '2xl': '1rem',   // 16px
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.2)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.3)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.4), 0 8px 10px -6px rgb(0 0 0 / 0.3)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.5)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.2)',
  focus: '0 0 0 2px #1e1f22, 0 0 0 4px rgba(88, 101, 242, 0.4)',
} as const;

export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
    mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
    display: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
  },
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],      // 12px
    sm: ['0.875rem', { lineHeight: '1.25rem' }],  // 14px
    base: ['1rem', { lineHeight: '1.5rem' }],     // 16px
    lg: ['1.125rem', { lineHeight: '1.75rem' }],  // 18px
    xl: ['1.25rem', { lineHeight: '1.75rem' }],   // 20px
    '2xl': ['1.5rem', { lineHeight: '2rem' }],    // 24px
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }], // 36px
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  letterSpacing: {
    tight: '-0.02em',
    normal: '0',
    wide: '0.02em',
  },
} as const;

export const transitions = {
  fast: '150ms ease',
  normal: '200ms ease',
  slow: '300ms ease',
} as const;

export const zIndex = {
  dropdown: 100,
  sticky: 200,
  modal: 300,
  popover: 400,
  tooltip: 500,
  toast: 600,
} as const;

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// Node dimensions for React Flow
export const nodeDimensions = {
  width: 220,
  height: {
    trigger: 80,
    action: 100,
    logic: 120,
    default: 100,
  },
  handleSize: 12,
  handleOffset: 6,
  padding: 12,
  borderRadius: 8,
} as const;

// Animation durations
export const animation = {
  fast: '100ms',
  normal: '200ms',
  slow: '300ms',
  enter: '200ms ease-out',
  exit: '150ms ease-in',
} as const;

export type Colors = typeof colors;
export type Spacing = typeof spacing;
export type BorderRadius = typeof borderRadius;
export type Shadows = typeof shadows;
export type Typography = typeof typography;
export type Transitions = typeof transitions;
export type ZIndex = typeof zIndex;
export type Breakpoints = typeof breakpoints;
export type NodeDimensions = typeof nodeDimensions;
export type Animation = typeof animation;

// CSS Custom Properties generator
export function generateCSSVariables(): string {
  const cssVars: string[] = [];

  // Colors
  Object.entries(colors).forEach(([category, values]) => {
    if (typeof values === 'object' && values !== null) {
      Object.entries(values).forEach(([key, value]) => {
        cssVars.push(`--color-${category}-${key}: ${value};`);
      });
    }
  });

  // Spacing
  Object.entries(spacing).forEach(([key, value]) => {
    cssVars.push(`--spacing-${key}: ${value};`);
  });

  // Border radius
  Object.entries(borderRadius).forEach(([key, value]) => {
    cssVars.push(`--radius-${key}: ${value};`);
  });

  // Shadows
  Object.entries(shadows).forEach(([key, value]) => {
    cssVars.push(`--shadow-${key}: ${value};`);
  });

  // Typography
  Object.entries(typography.fontSize).forEach(([key, value]) => {
    cssVars.push(`--font-size-${key}: ${value[0]};`);
    cssVars.push(`--line-height-${key}: ${value[1].lineHeight};`);
  });

  Object.entries(typography.fontWeight).forEach(([key, value]) => {
    cssVars.push(`--font-weight-${key}: ${value};`);
  });

  // Transitions
  Object.entries(transitions).forEach(([key, value]) => {
    cssVars.push(`--transition-${key}: ${value};`);
  });

  // Z-index
  Object.entries(zIndex).forEach(([key, value]) => {
    cssVars.push(`--z-${key}: ${value};`);
  });

  // Animation
  Object.entries(animation).forEach(([key, value]) => {
    cssVars.push(`--animation-${key}: ${value};`);
  });

  return `:root {\n  ${cssVars.join('\n  ')}\n}`;
}