'use client';

import { useDocs } from '../layout';

export default function ThemingPage() {
  const { H1, H2, H3, P, Code, CodeBlock, Callout, PrevNext } = useDocs();

  return (
    <>
      <H1>Theming</H1>
      <P>
        PartyLayer includes a built-in theme system with light, dark, and auto modes.
        You can also create fully custom themes to match your application{"'"}s design.
      </P>

      <H2 id="built-in-themes">Built-in Themes</H2>
      <P>
        Pass a theme preset to <Code>{'PartyLayerKit'}</Code>:
      </P>
      <CodeBlock language="tsx">{`// Light theme (default)
<PartyLayerKit theme="light" network="mainnet" appName="My dApp">

// Dark theme
<PartyLayerKit theme="dark" network="mainnet" appName="My dApp">

// Auto, follows system preference (prefers-color-scheme)
<PartyLayerKit theme="auto" network="mainnet" appName="My dApp">`}</CodeBlock>

      <H2 id="custom-theme">Custom Theme</H2>
      <P>
        Create a custom theme by providing a <Code>{'PartyLayerTheme'}</Code> object.
        The easiest way is to spread a built-in theme and override specific values:
      </P>
      <CodeBlock language="tsx">{`import { PartyLayerKit, lightTheme } from '@partylayer/react';

const myTheme = {
  ...lightTheme,
  colors: {
    ...lightTheme.colors,
    primary: '#7C3AED',       // Purple primary
    primaryHover: '#6D28D9',  // Darker purple on hover
    background: '#FAFAFA',    // Slightly off-white background
  },
  borderRadius: '12px',
};

function App() {
  return (
    <PartyLayerKit theme={myTheme} network="mainnet" appName="My dApp">
      {/* Components will use your custom theme */}
    </PartyLayerKit>
  );
}`}</CodeBlock>

      <H2 id="theme-interface">PartyLayerTheme Interface</H2>
      <CodeBlock language="typescript">{`interface PartyLayerTheme {
  mode: 'light' | 'dark';
  colors: {
    primary: string;        // Brand color (default: #FFCC00)
    primaryHover: string;   // Brand hover state
    background: string;     // Page/modal background
    surface: string;        // Card/surface background
    text: string;           // Primary text color
    textSecondary: string;  // Secondary/muted text
    border: string;         // Border color
    success: string;        // Success state text
    successBg: string;      // Success state background
    error: string;          // Error state text
    errorBg: string;        // Error state background
    warning: string;        // Warning state text
    warningBg: string;      // Warning state background
    overlay: string;        // Modal backdrop overlay
  };
  borderRadius: string;     // Default: '10px'
  fontFamily: string;       // System font stack
}`}</CodeBlock>

      <H2 id="presets">Theme Presets</H2>
      <P>
        Both built-in themes are exported for use as base themes:
      </P>

      <H3>Light Theme</H3>
      <CodeBlock language="tsx">{`import { lightTheme } from '@partylayer/react';

// lightTheme.colors:
// primary: '#FFCC00'
// background: '#FFFFFF'
// surface: '#F5F6F8'
// text: '#0B0F1A'
// textSecondary: '#64748B'
// border: 'rgba(15, 23, 42, 0.10)'
// overlay: 'rgba(15, 23, 42, 0.20)'`}</CodeBlock>

      <H3>Dark Theme</H3>
      <CodeBlock language="tsx">{`import { darkTheme } from '@partylayer/react';

// darkTheme.colors:
// primary: '#FFCC00'
// background: '#0B0F1A'
// surface: '#151926'
// text: '#E2E8F0'
// textSecondary: '#94A3B8'
// border: 'rgba(255, 255, 255, 0.08)'
// overlay: 'rgba(0, 0, 0, 0.60)'`}</CodeBlock>

      <H2 id="accessing-theme">Accessing the Theme</H2>
      <P>
        Use the <Code>{'useTheme'}</Code> hook to access the current theme from any component:
      </P>
      <CodeBlock language="tsx">{`import { useTheme } from '@partylayer/react';

function StyledCard() {
  const theme = useTheme();

  return (
    <div style={{
      background: theme.colors.surface,
      color: theme.colors.text,
      border: \`1px solid \${theme.colors.border}\`,
      borderRadius: theme.borderRadius,
      padding: 16,
    }}>
      <h3>Themed Card</h3>
      <p style={{ color: theme.colors.textSecondary }}>
        This card follows the PartyLayer theme.
      </p>
    </div>
  );
}`}</CodeBlock>

      <H2 id="theme-provider">Direct ThemeProvider Usage</H2>
      <P>
        If you{"'"}re using <Code>{'PartyLayerProvider'}</Code> directly (instead of <Code>{'PartyLayerKit'}</Code>),
        wrap your components in <Code>{'ThemeProvider'}</Code>:
      </P>
      <CodeBlock language="tsx">{`import { PartyLayerProvider, ThemeProvider, darkTheme } from '@partylayer/react';
import { createPartyLayer } from '@partylayer/sdk';

const client = createPartyLayer({ network: 'mainnet', app: { name: 'My dApp' } });

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <PartyLayerProvider client={client}>
        {/* Your app */}
      </PartyLayerProvider>
    </ThemeProvider>
  );
}`}</CodeBlock>

      <Callout type="tip">
        <Code>{'PartyLayerKit'}</Code> wraps <Code>{'ThemeProvider'}</Code> and <Code>{'PartyLayerProvider'}</Code> together,
        so you don{"'"}t need to set them up separately when using the zero-config approach.
      </Callout>

      <PrevNext />
    </>
  );
}
