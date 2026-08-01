import {
  button,
  element,
  installStyles,
  joinPath,
  layout,
  listAll,
  readAll,
  renderInfo,
  request,
  showMetadata,
  text,
} from './runtime.js';

installStyles('styles.css');

export async function open(resource, root) {
  const view = layout(root, resource.displayName);
  const entry = await findHTML(resource);
  if (!entry) {
    view.preview.append(element('div', 'empty-state warning', 'No HTML entry point was found.'));
    return;
  }
  view.sidebar.append(button(entry.id, () => renderHTML(entry, view), 'tree-row'));
  view.search.hidden = true;
  await renderHTML(entry, view);
}

async function findHTML(resource) {
  if (resource.kind === 'file') {
    return {
      id: resource.displayName,
      name: resource.displayName,
      byteCount: resource.byteCount ?? 0,
      mediaType: resource.mediaType,
    };
  }
  const entries = await listAll(undefined);
  return entries.find(entry => entry.name.toLowerCase() === 'index.html')
    ?? entries.find(entry => /\.html?$/i.test(entry.name));
}

async function renderHTML(entry, view) {
  view.preview.replaceChildren(element('div', 'empty-state', 'Sanitizing HTML…'));
  const bytes = await readAll(entry.id, entry.byteCount ?? 0, 10 * 1024 * 1024);
  const documentValue = new DOMParser().parseFromString(text(bytes), 'text/html');
  const basePath = entry.id.includes('/') ? entry.id.slice(0, entry.id.lastIndexOf('/')) : '';
  const report = { removedElements: 0, removedAttributes: 0, blockedRequests: 0 };

  for (const node of documentValue.querySelectorAll('script,noscript,iframe,frame,object,embed,form,input,button,textarea,select,option,base,meta[http-equiv]')) {
    node.remove();
    report.removedElements += 1;
  }
  for (const node of documentValue.querySelectorAll('*')) {
    for (const attribute of [...node.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith('on') || ['srcdoc', 'formaction', 'action', 'ping'].includes(name)) {
        node.removeAttribute(attribute.name);
        report.removedAttributes += 1;
      } else if (name === 'style' && /url\s*\(|expression\s*\(/i.test(value)) {
        node.removeAttribute(attribute.name);
        report.blockedRequests += 1;
      }
    }
  }

  for (const style of documentValue.querySelectorAll('style')) {
    style.textContent = sanitizeCSS(style.textContent ?? '', report);
  }
  for (const link of [...documentValue.querySelectorAll('link[rel="stylesheet"][href]')]) {
    const href = link.getAttribute('href') ?? '';
    if (!isLocal(href)) {
      link.remove(); report.blockedRequests += 1; continue;
    }
    try {
      const id = joinPath(basePath, stripQuery(href));
      const info = await renderInfo(id);
      const css = text(await readAll(id, Number(info.metadata.byteCount), 5 * 1024 * 1024));
      const style = documentValue.createElement('style');
      style.textContent = sanitizeCSS(css, report);
      link.replaceWith(style);
    } catch {
      link.remove(); report.blockedRequests += 1;
    }
  }

  for (const image of documentValue.querySelectorAll('img[src]')) {
    const src = image.getAttribute('src') ?? '';
    image.removeAttribute('srcset');
    if (src.startsWith('data:image/')) continue;
    if (!isLocal(src)) {
      image.removeAttribute('src'); report.blockedRequests += 1; continue;
    }
    try {
      image.src = (await renderInfo(joinPath(basePath, stripQuery(src)))).resourceURL;
    } catch {
      image.removeAttribute('src'); report.blockedRequests += 1;
    }
  }
  for (const anchor of documentValue.querySelectorAll('a[href]')) {
    const href = anchor.getAttribute('href') ?? '';
    anchor.removeAttribute('target');
    anchor.removeAttribute('download');
    if (!isLocal(href) && !href.startsWith('#')) {
      anchor.href = '#';
      anchor.title = 'Remote navigation blocked';
      report.blockedRequests += 1;
    }
  }

  const toolbar = element('div', 'toolbar');
  toolbar.append(button('Open in external browser', () => request('openExternally', { entryID: entry.id })));
  const frame = element('section', 'safe-html');
  for (const child of [...documentValue.body.childNodes]) frame.append(document.importNode(child, true));
  view.preview.replaceChildren(toolbar, frame);
  showMetadata(view.metadata, {
    Source: entry.id,
    'Removed elements': report.removedElements,
    'Removed attributes': report.removedAttributes,
    'Blocked requests': report.blockedRequests,
    Scripts: 'Disabled',
    Forms: 'Disabled',
    Network: 'Disabled',
  });
}

function sanitizeCSS(source, report) {
  return source
    .replace(/@import[^;]+;?/gi, () => { report.blockedRequests += 1; return ''; })
    .replace(/url\s*\([^)]*\)/gi, () => { report.blockedRequests += 1; return 'none'; })
    .replace(/expression\s*\([^)]*\)/gi, '');
}

function isLocal(value) {
  const lower = value.trim().toLowerCase();
  return lower && !lower.startsWith('//') && !/^[a-z][a-z0-9+.-]*:/i.test(lower);
}

function stripQuery(value) {
  return value.split(/[?#]/, 1)[0];
}
