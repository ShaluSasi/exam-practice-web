import { memo, type ReactNode } from "react";
import katex from "katex";
import "katex/contrib/mhchem";

const TOKEN = /(\$\$[\s\S]+?\$\$|\$[^$]+?\$|\*\*[^*]+?\*\*|\*[^*\s][^*]*?\*)/g;

function tex(src: string, display: boolean, key: number) {
  const html = katex.renderToString(src, { displayMode: display, throwOnError: false, strict: "ignore" });
  return display ? (
    <span key={key} className="block" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span key={key} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

/** Renders $inline$ / $$display$$ maths, **bold** and *italic*. */
export const RichText = memo(function RichText({ text, className }: { text: string; className?: string }) {
  const out: ReactNode[] = [];
  text.split(TOKEN).forEach((part, i) => {
    if (!part) return;
    if (part.startsWith("$$")) out.push(tex(part.slice(2, -2), true, i));
    else if (part.startsWith("$")) out.push(tex(part.slice(1, -1), false, i));
    // Bold and italic runs may hold maths of their own, e.g. **coefficient of $z$**.
    else if (part.startsWith("**")) out.push(<strong key={i} className="font-bold"><RichText text={part.slice(2, -2)} /></strong>);
    else if (part.startsWith("*") && part.endsWith("*") && part.length > 2) out.push(<em key={i}><RichText text={part.slice(1, -1)} /></em>);
    else out.push(part);
  });
  return <span className={className}>{out}</span>;
});
