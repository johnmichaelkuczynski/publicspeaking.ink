interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="whitespace-pre-wrap font-sans text-foreground">
      {content}
    </div>
  );
}
