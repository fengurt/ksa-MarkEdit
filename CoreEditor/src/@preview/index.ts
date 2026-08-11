import { markdownLanguage } from '@codemirror/lang-markdown';
import { Tree, TreeFragment } from '@lezer/common';
import { applyTextChanges, EditorTextChange, treeChanges } from './incremental';
import { renderMarkdown } from './renderer';
import './style.css';

type PreviewMessage = {
  type: 'source' | 'link';
  position?: number;
  url?: string;
};

declare global {
  interface Window {
    previewBridge: {
      reset: (text: string, revision: number) => boolean;
      applyChanges: (changes: EditorTextChange[], revision: number, compositionEnded: boolean) => boolean;
      scrollTo: (position: number) => boolean;
      render: () => boolean;
    };
    webkit?: {
      messageHandlers?: {
        workspacePreview?: {
          postMessage: (message: PreviewMessage) => void;
        };
      };
    };
  }
}

let source = '';
let revision = 0;
let tree: Tree = markdownLanguage.parser.parse('');
let fragments = TreeFragment.addTree(tree);
let renderFrame: number | undefined;
const content = document.querySelector<HTMLElement>('#content');

window.previewBridge = {
  reset(text: string, newRevision: number) {
    source = text;
    revision = newRevision;
    tree = markdownLanguage.parser.parse(source);
    fragments = TreeFragment.addTree(tree);
    scheduleRender();
    return true;
  },

  applyChanges(changes: EditorTextChange[], newRevision: number, compositionEnded: boolean) {
    if (newRevision !== revision + 1) {
      return false;
    }

    fragments = TreeFragment.applyChanges(fragments, treeChanges(changes));
    source = applyTextChanges(source, changes);

    revision = newRevision;
    tree = markdownLanguage.parser.parse(source, fragments);
    fragments = TreeFragment.addTree(tree);
    if (compositionEnded) {
      scheduleRender();
    }
    return true;
  },

  scrollTo(position: number) {
    const candidates = [...document.querySelectorAll<HTMLElement>('[data-source-from]')]
      .filter(element => Number(element.dataset.sourceFrom) <= position)
      .sort((lhs, rhs) => Number(rhs.dataset.sourceFrom) - Number(lhs.dataset.sourceFrom));
    const target = candidates.shift();
    if (target === undefined) {
      return false;
    }

    target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    return true;
  },

  render() {
    scheduleRender();
    return true;
  },
};

document.addEventListener('click', event => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const link = target.closest<HTMLAnchorElement>('a');
  if (link !== null) {
    event.preventDefault();
    const href = link.getAttribute('href') ?? '';
    if (href.startsWith('#')) {
      let identifier = href.slice(1);
      try {
        identifier = decodeURIComponent(identifier);
      } catch {
        // Keep a malformed fragment inert instead of interrupting preview interaction.
      }
      document.getElementById(identifier)?.scrollIntoView({ block: 'start' });
    } else {
      postMessage({ type: 'link', url: href });
    }
    return;
  }

  const sourceElement = target.closest<HTMLElement>('[data-source-from]');
  if (sourceElement !== null) {
    postMessage({
      type: 'source',
      position: Number(sourceElement.dataset.sourceFrom ?? '0'),
    });
  }
});

function scheduleRender() {
  if (renderFrame !== undefined) {
    cancelAnimationFrame(renderFrame);
  }
  renderFrame = requestAnimationFrame(() => {
    renderFrame = undefined;
    if (content !== null) {
      content.innerHTML = renderMarkdown(source, tree);
    }
  });
}

function postMessage(message: PreviewMessage) {
  window.webkit?.messageHandlers?.workspacePreview?.postMessage(message);
}
