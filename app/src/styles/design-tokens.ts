/**
 * Nexora Bots UI - Design Tokens
 * Centralized design system for the bot management interface
 * Updated with refined, cohesive visual language
 */

export const colors = {
  // Brand colors - Refined Discord blurple with better accessibility
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

  // Semantic colors - Better contrast ratios
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

  // Node category colors - More distinct, accessible
  node: {
    trigger: {
      bg: 'rgba(59, 165, 92, 0.14)',
      border: '#3ba55c',
      text: '#3ba55c',
      handle: '#3ba55c',
      hover: 'rgba(59, 165, 92, 0.22)',
      active: 'rgba(59, 165, 92, 0.28)',
    },
    action: {
      bg: 'rgba(88, 101, 242, 0.14)',
      border: '#5865f2',
      text: '#5865f2',
      handle: '#5865f2',
      hover: 'rgba(88, 101, 242, 0.22)',
      active: 'rgba(88, 101, 242, 0.28)',
    },
    logic: {
      bg: 'rgba(250, 166, 26, 0.14)',
      border: '#faa61a',
      text: '#faa61a',
      handle: '#faa61a',
      hover: 'rgba(250, 166, 26, 0.22)',
      active: 'rgba(250, 166, 26, 0.28)',
    },
  },

  // Neutral/Dark mode first - Refined Discord-like surfaces
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

  // Background surfaces (dark mode) - More depth, better hierarchy
  surface: {
    primary: '#18191c',        // Main background - slightly darker for depth
    secondary: '#1e1f22',      // Cards, modals
    tertiary: '#292b2f',       // Elevated surfaces
    hover: '#32353a',          // Hover states
    active: '#3a3d42',         // Active/pressed
    border: '#2f3136',         // Subtle borders
    borderStrong: '#3e4147',   // Strong borders
    overlay: 'rgba(0, 0, 0, 0.6)', // Modal overlays
  },

  // Text colors (dark mode) - Better hierarchy
  text: {
    primary: '#ffffff',        // Highest contrast
    secondary: '#dcddde',      // Secondary content
    tertiary: '#939598',       // Tertiary/muted
    quaternary: '#72767d',     // Disabled/placeholder
    inverse: '#18191c',
    link: '#5865f2',
    linkHover: '#7678db',
    linkVisited: '#a3a8f0',
  },

  // Status colors - More vibrant
  status: {
    enabled: '#3ba55c',
    disabled: '#939598',
    pending: '#faa61a',
    error: '#ed4245',
    running: '#5865f2',
  },

  // Focus ring - Visible, accessible
  focus: {
    ring: 'rgba(88, 101, 242, 0.45)',
    ringOffset: '#18191c',
  },

  // Gradient accents for premium feel
  gradients: {
    primary: 'linear-gradient(135deg, #5865f2 0%, #7678db 100%)',
    success: 'linear-gradient(135deg, #3ba55c 0%, #4ade80 100%)',
    danger: 'linear-gradient(135deg, #ed4245 0%, #f87171 100%)',
    warning: 'linear-gradient(135deg, #faa61a 0%, #fbbf24 100%)',
    surface: 'linear-gradient(180deg, #1e1f22 0%, #18191c 100%)',
    card: 'linear-gradient(180deg, #25272b 0%, #1e1f22 100%)',
    mesh: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(88, 101, 242, 0.15), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(250, 166, 26, 0.1), transparent)',
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
  xs: '0.125rem',   // 2px
  sm: '0.25rem',    // 4px
  md: '0.375rem',   // 6px
  lg: '0.5rem',     // 8px
  xl: '0.75rem',    // 12px
  '2xl': '1rem',    // 16px
  '3xl': '1.5rem',  // 24px
  full: '9999px',
} as const;

export const shadows = {
  none: 'none',
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.4), 0 1px 2px -1px rgb(0 0 0 / 0.3)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.3)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.4), 0 8px 10px -6px rgb(0 0 0 / 0.3)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.5)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.2)',
  focus: '0 0 0 2px #18191c, 0 0 0 4px rgba(88, 101, 242, 0.45)',
  glow: '0 0 20px rgba(88, 101, 242, 0.3)',
  glowSuccess: '0 0 20px rgba(59, 165, 92, 0.3)',
  glowWarning: '0 0 20px rgba(250, 166, 26, 0.3)',
  card: '0 2px 8px -2px rgb(0 0 0 / 0.3), 0 1px 2px -1px rgb(0 0 0 / 0.2)',
  cardHover: '0 8px 24px -4px rgb(0 0 0 / 0.4), 0 4px 8px -2px rgb(0 0 0 / 0.3)',
  modal: '0 24px 48px -12px rgb(0 0 0 / 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
  popover: '0 12px 24px -4px rgb(0 0 0 / 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)',
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
    '5xl': ['3rem', { lineHeight: '1' }],         // 48px
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
    wider: '0.04em',
  },
  lineHeight: {
    tight: '1.1',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
    loose: '2',
  },
} as const;

export const transitions = {
  fast: '120ms cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  spring: '300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
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
  width: 240,
  height: {
    trigger: 72,
    action: 96,
    logic: 112,
    default: 96,
    compact: 60,
  },
  handleSize: 14,
  handleOffset: 7,
  padding: 14,
  borderRadius: 10,
  handleBorderWidth: 3,
} as const;

// Animation durations
export const animation = {
  fast: '100ms',
  normal: '200ms',
  slow: '300ms',
  enter: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  exit: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  spring: '350ms cubic-bezier(0.34, 1.56, 0.64, 1)',
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

  // Node dimensions
  Object.entries(nodeDimensions).forEach(([key, value]) => {
    if (typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => {
        cssVars.push(`--node-${key}-${k}: ${v};`);
      });
    } else {
      cssVars.push(`--node-${key}: ${value};`);
    }
  });

  return `:root {\n  ${cssVars.join('\n  ')}\n}`;
}