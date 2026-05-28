export function MarkdownPreview({ markdown }: { markdown: string }) {
  return (
    <pre className="markdown-preview" aria-label="Markdown preview">
      {markdown}
    </pre>
  );
}
