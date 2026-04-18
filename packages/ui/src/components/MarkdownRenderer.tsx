interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const lines = content.trim().split('\n');

  return (
    <div className="max-w-none">
      {lines.map((line, i) => {
        if (line.startsWith('# ')) {
          return (
            <h1 key={i} className="text-2xl font-semibold text-[var(--text-primary)] mb-6">
              {line.slice(2)}
            </h1>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h2 key={i} className="text-xl font-medium text-[var(--text-primary)] mt-8 mb-4 border-b border-[var(--border-default)] pb-2">
              {line.slice(3)}
            </h2>
          );
        }
        if (line.startsWith('- ')) {
          return (
            <li key={i} className="text-[var(--text-secondary)] ml-4 mb-2 text-[14px]">
              {line.slice(2)}
            </li>
          );
        }
        if (line.trim() === '') {
          return <br key={i} />;
        }
        return (
          <p key={i} className="text-[var(--text-secondary)] mb-4 leading-relaxed text-[14px]">
            {line}
          </p>
        );
      })}
    </div>
  );
}
