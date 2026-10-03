const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 py-2 text-sm font-semibold motion-safe:transition-colors duration-[var(--ui-duration-fast)] disabled:cursor-not-allowed disabled:bg-ui-surface-muted disabled:text-ui-disabled disabled:border-ui-border";
export const primaryButton = `${buttonBase} border border-transparent bg-ui-accent text-white hover:bg-ui-accent-hover active:bg-ui-accent-hover disabled:hover:bg-ui-surface-muted disabled:active:bg-ui-surface-muted`;
export const secondaryButton = `${buttonBase} border border-ui-control-border bg-ui-surface text-ui-foreground hover:bg-ui-surface-muted active:bg-ui-selected disabled:active:bg-ui-surface-muted`;
export const dangerButton = `${buttonBase} border border-transparent bg-ui-danger text-white enabled:hover:brightness-90 enabled:active:brightness-90`;
export const quietButton = `${buttonBase} border border-transparent text-ui-secondary enabled:hover:bg-ui-surface-muted enabled:active:bg-ui-selected`;
export const controlStyle =
  "min-h-11 w-full rounded-control border border-ui-control-border bg-ui-surface px-3 py-2 text-base text-ui-foreground placeholder:text-ui-muted disabled:cursor-not-allowed disabled:bg-ui-surface-muted disabled:text-ui-disabled disabled:border-ui-border";
