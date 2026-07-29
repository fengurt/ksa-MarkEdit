export function renderMarkdown(source: string): string {
  const escaped = escapeHTML(source.replace(/^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)\r?\n/u, ''));
  const lines = escaped.split(/\r?\n/);
  const output: string[] = [];
  let inCode = false;
  let inList = false;

  for (const line of lines) {
    if (line.startsWith('```')) {
      output.push(inCode ? '</code></pre>' : '<pre><code>');
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      output.push(`${line}\n`);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/u);
    if (heading) {
      closeList(output, inList);
      inList = false;
      const level = heading[1]?.length ?? 1;
      output.push(`<h${level}>${inline(heading[2] ?? '')}</h${level}>`);
      continue;
    }
    const list = line.match(/^\s*[-*+]\s+(.+)$/u);
    if (list) {
      if (!inList) {
        output.push('<ul>');
        inList = true;
      }
      output.push(`<li>${inline(list[1] ?? '')}</li>`);
      continue;
    }
    if (inList) {
      output.push('</ul>');
      inList = false;
    }
    if (line.startsWith('&gt; ')) {
      output.push(`<blockquote>${inline(line.slice(5))}</blockquote>`);
    } else if (line.trim()) {
      output.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList(output, inList);
  if (inCode) {
    output.push('</code></pre>');
  }
  return output.join('');
}

function inline(value: string): string {
  return value
    .replace(/`([^`]+)`/gu, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/gu, '<strong>$1</strong>')
    .replace(/~~([^~]+)~~/gu, '<del>$1</del>')
    .replace(/\*([^*]+)\*/gu, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/gu, (_match, label: string, href: string) => {
      const safeHref = /^(?:https?:|mailto:|\/|\.{0,2}\/|#)/iu.test(href) ? href : '#';
      return `<a href="${escapeAttribute(safeHref)}" rel="noreferrer">${label}</a>`;
    });
}

function closeList(output: string[], inList: boolean): void {
  if (inList) {
    output.push('</ul>');
  }
}

function escapeHTML(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value: string): string {
  return escapeHTML(value).replaceAll('`', '&#096;');
}
