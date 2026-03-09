import { createTheme, type MantineColorsTuple } from '@mantine/core';

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
          borderColor: 'var(--mantine-color-dark-4)',
          backgroundColor: 'var(--mantine-color-dark-6)',
        },
      }),
    },
    Table: {
      styles: () => ({
        th: {
          color: 'var(--mantine-color-dark-1)',
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
