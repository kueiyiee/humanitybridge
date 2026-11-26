import React from 'react';

function renderInlineStoryText(text: string, keyPrefix: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https:\/\/[^)\s]+\))/g);
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={key}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith('*') && token.endsWith('*')) {
      return <em key={key}>{token.slice(1, -1)}</em>;
    }
    const link = token.match(/^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/);
    if (link) {
      try {
        const href = new URL(link[2]);
        if (href.protocol === 'https:') {
          return <a key={key} href={href.href} target="_blank" rel="noopener noreferrer" className="underline">{link[1]}</a>;
        }
      } catch {
        return token;
      }
    }
    return token;
  });
}

export function renderStoryBody(body: string): React.ReactNode[] {
  const lines = body.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const Heading = heading[1].length === 1 ? 'h2' : 'h3';
      blocks.push(<Heading key={`heading-${index}`} className="font-editorial text-2xl font-semibold">{renderInlineStoryText(heading[2], `heading-${index}`)}</Heading>);
      index += 1;
      continue;
    }
    if (line.startsWith('> ')) {
      const quote: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('> ')) {
        quote.push(lines[index].trim().slice(2));
        index += 1;
      }
      blocks.push(<blockquote key={`quote-${index}`} className="border-l-2 border-slate-400 pl-4 italic text-slate-600 dark:text-slate-300">{renderInlineStoryText(quote.join(' '), `quote-${index}`)}</blockquote>);
      continue;
    }
    const isOrdered = /^\d+[.)]\s+/.test(line);
    if (isOrdered || /^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && (isOrdered ? /^\d+[.)]\s+/.test(lines[index].trim()) : /^[-*]\s+/.test(lines[index].trim()))) {
        items.push(lines[index].trim().replace(isOrdered ? /^\d+[.)]\s+/ : /^[-*]\s+/, ''));
        index += 1;
      }
      const List = isOrdered ? 'ol' : 'ul';
      blocks.push(<List key={`list-${index}`} className={isOrdered ? 'list-decimal pl-6' : 'list-disc pl-6'}>
        {items.map((item, itemIndex) => <li key={itemIndex}>{renderInlineStoryText(item, `list-${index}-${itemIndex}`)}</li>)}
      </List>);
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() &&
      !/^(#{1,3})\s+/.test(lines[index].trim()) &&
      !lines[index].trim().startsWith('> ') &&
      !/^[-*]\s+/.test(lines[index].trim()) &&
      !/^\d+[.)]\s+/.test(lines[index].trim())) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={`paragraph-${index}`}>{renderInlineStoryText(paragraph.join(' '), `paragraph-${index}`)}</p>);
  }
  return blocks;
}
