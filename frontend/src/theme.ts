import { createTheme, type MantineColorsTuple, type CSSVariablesResolver } from '@mantine/core';

const cyberGreen: MantineColorsTuple = [
  '#e6fff2', '#b3ffd9', '#80ffc0', '#4dffa6', '#1aff8d',
  '#00e673', '#00b359', '#008040', '#004d26', '#001a0d',
];

const alertRed: MantineColorsTuple = [
  '#ffe5e5', '#ffb3b3', '#ff8080', '#ff4d4d', '#ff1a1a',
  '#e60000', '#b30000', '#800000', '#4d0000', '#1a0000',
];

const electricBlue: MantineColorsTuple = [
  '#e5f0ff', '#b3d4ff', '#80b8ff', '#4d9cff', '#1a80ff',
  '#0066e6', '#0052b3', '#003d80', '#00294d', '#00141a',
];

// ============================================
// CSS VARIABLES RESOLVER — Light / Dark tokens
// ============================================

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    // Shell
    '--app-shell-bg': '#f0f2f5',
    '--app-surface': '#ffffff',
    '--app-border': '#dee2e6',
    '--app-hover': '#f1f3f5',
    // Text
    '--app-text-primary': '#1a1a1a',
    '--app-text-secondary': '#495057',
    '--app-text-dimmed': '#868e96',
    // Charts
    '--app-chart-bg': '#ffffff',
    '--app-chart-border': '#dee2e6',
    '--app-chart-text': '#495057',
    '--app-chart-tooltip-bg': '#ffffff',
    '--app-chart-tooltip-color': '#1a1a1a',
    // Progress bar track
    '--app-track-bg': '#e9ecef',
    // Nav
    '--app-nav-active-text': '#ffffff',
    '--app-nav-text': '#495057',
    '--app-nav-section-text': '#868e96',
  },
  dark: {
    // Shell
    '--app-shell-bg': 'var(--mantine-color-dark-7)',
    '--app-surface': 'var(--mantine-color-dark-6)',
    '--app-border': 'var(--mantine-color-dark-4)',
    '--app-hover': 'var(--mantine-color-dark-5)',
    // Text
    '--app-text-primary': '#ffffff',
    '--app-text-secondary': '#C1C2C5',
    '--app-text-dimmed': '#909296',
    // Charts
    '--app-chart-bg': '#25262B',
    '--app-chart-border': '#373A40',
    '--app-chart-text': '#A6A7AB',
    '--app-chart-tooltip-bg': '#25262B',
    '--app-chart-tooltip-color': '#ffffff',
    // Progress bar track
    '--app-track-bg': 'var(--mantine-color-dark-5)',
    // Nav
    '--app-nav-active-text': '#ffffff',
    '--app-nav-text': 'var(--mantine-color-dark-1)',
    '--app-nav-section-text': 'var(--mantine-color-dark-2)',
  },
});

// ============================================
// THEME
// ============================================

export const theme = createTheme({
  primaryColor: 'electricBlue',
  primaryShade: { light: 6, dark: 4 },

  colors: {
    cyberGreen,
    alertRed,
    electricBlue,
    dark: [
      '#C1C2C5', '#A6A7AB', '#909296', '#5C5F66', '#373A40',
      '#2C2E33', '#25262B', '#1A1B1E', '#141517', '#101113',
    ],
  },

  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  headings: {
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    fontWeight: '600',
  },

  defaultRadius: 'md',

  components: {
    Card: {
      defaultProps: { radius: 'lg', padding: 'lg', withBorder: true },
      styles: () => ({
        root: {
          borderColor: 'var(--app-border)',
          backgroundColor: 'var(--app-surface)',
        },
      }),
    },
    Table: {
      styles: () => ({
        th: {
          color: 'var(--app-text-secondary)',
          fontWeight: 600,
          fontSize: '0.75rem',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.05em',
        },
      }),
    },
    Modal: {
      defaultProps: {
        radius: 'lg',
        overlayProps: { backgroundOpacity: 0.65, blur: 3 },
      },
    },
  },
});
