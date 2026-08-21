/** Shared dark-mode surface remaps for duty modules embedded in the portal. */
export const DARK_THEME_CSS = `
html.dark {
  color-scheme: dark;
  --background: #0b1220;
  --foreground: #e8eef7;
  --fg: #e8eef7;
  --muted: #c5d0dc;
  --border: #243044;
  --brand: #f59e0b;
  --brand-dark: #fbbf24;
  --sidebar: #070d18;
  --sidebar-fg: #f8fafc;
  --card: #121a2a;
  --table-head: #0f172a;
  --table-hover: #152033;
  --surface-muted: #152033;
}

html.dark body {
  background: var(--background);
  color: var(--foreground);
  background-image:
    linear-gradient(180deg, rgba(245, 158, 11, 0.06), transparent 180px),
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 23px,
      rgba(232, 238, 247, 0.02) 24px
    );
}

html.dark .bg-white,
html.dark .bg-white\\/95,
html.dark .bg-white\\/90 {
  background-color: var(--card) !important;
}

html.dark .bg-slate-50,
html.dark .bg-slate-100,
html.dark .bg-amber-50,
html.dark .bg-orange-50 {
  background-color: var(--surface-muted) !important;
}

html.dark .text-slate-700,
html.dark .text-slate-600,
html.dark .text-slate-500,
html.dark .text-slate-400,
html.dark .text-slate-300 {
  color: var(--muted) !important;
}

html.dark .text-slate-800,
html.dark .text-slate-900,
html.dark .text-slate-950 {
  color: var(--fg) !important;
}

html.dark .border-slate-100,
html.dark .border-slate-200,
html.dark .border-slate-300 {
  border-color: var(--border) !important;
}

html.dark th {
  background: var(--table-head) !important;
  color: var(--muted) !important;
}

html.dark tr:hover td {
  background: var(--table-hover) !important;
}

html.dark .btn,
html.dark .input,
html.dark .select,
html.dark .textarea,
html.dark input:not([type="checkbox"]):not([type="radio"]),
html.dark select,
html.dark textarea {
  background: var(--card) !important;
  color: var(--fg) !important;
  border-color: var(--border) !important;
  color-scheme: dark;
}

html.dark option,
html.dark optgroup {
  background-color: var(--card);
  color: var(--fg);
}

html.dark ::placeholder {
  color: var(--muted);
  opacity: 0.9;
}

html.dark .btn:hover {
  background: var(--surface-muted);
}

html.dark .btn-primary {
  background: var(--brand);
  border-color: var(--brand-dark);
  color: #fff;
}
`;
