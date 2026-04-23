interface HoverHelpProps {
  subtitle?: string;
  description?: string;
  open: boolean;
}

/**
 * Cell help overlay. Dumb display: `open` is controlled by the parent. Matches
 * the legacy DOM exactly — `div.hover-help` with optional `<h4>` subtitle and
 * `<p>` description (HTML allowed, already sanitized at config-load time).
 */
export function HoverHelp({ subtitle, description, open }: HoverHelpProps) {
  return (
    <div className="hover-help" style={{ display: open ? 'block' : 'none' }}>
      {subtitle && <h4>{subtitle}</h4>}
      {description && <p dangerouslySetInnerHTML={{ __html: description }} />}
    </div>
  );
}
