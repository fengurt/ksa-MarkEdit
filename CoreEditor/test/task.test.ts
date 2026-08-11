import { describe, expect, test, beforeEach } from '@jest/globals';
import { taskMarkerStyle } from '../src/styling/nodes/task';
import { Config } from '../src/config';
import * as editor from './utils/editor';

async function waitForTaskMarkers(count: number, timeout = 2_000) {
  const deadline = Date.now() + timeout;
  while (document.querySelectorAll('.cm-md-taskMarker').length < count) {
    if (Date.now() >= deadline) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

describe('Task marker decoration', () => {
  beforeEach(() => {
    // Plugin runs during EditorView construction and reads window.config,
    // so it must exist before setUp().
    window.config = {} as Config;
    // setUp() appends a new editor to document.body each time; clear stale ones.
    document.body.innerHTML = '';
  });

  test('decorates unchecked tasks with cm-md-taskMarker-unchecked', async () => {
    editor.setUp('- [ ] todo', taskMarkerStyle);
    await waitForTaskMarkers(1);

    const marker = document.querySelector('.cm-md-taskMarker');
    expect(marker).not.toBeNull();
    expect(marker?.classList.contains('cm-md-taskMarker-unchecked')).toBe(true);
    expect(marker?.classList.contains('cm-md-taskMarker-checked')).toBe(false);
  });

  test('decorates checked tasks with cm-md-taskMarker-checked (lowercase x)', async () => {
    editor.setUp('- [x] done', taskMarkerStyle);
    await waitForTaskMarkers(1);

    const marker = document.querySelector('.cm-md-taskMarker');
    expect(marker).not.toBeNull();
    expect(marker?.classList.contains('cm-md-taskMarker-checked')).toBe(true);
    expect(marker?.classList.contains('cm-md-taskMarker-unchecked')).toBe(false);
  });

  test('decorates checked tasks with cm-md-taskMarker-checked (uppercase X)', async () => {
    editor.setUp('- [X] done', taskMarkerStyle);
    await waitForTaskMarkers(1);

    const marker = document.querySelector('.cm-md-taskMarker');
    expect(marker?.classList.contains('cm-md-taskMarker-checked')).toBe(true);
  });

  test('decorates mixed task lists with the correct state per line', async () => {
    editor.setUp('- [ ] one\n- [x] two\n- [X] three', taskMarkerStyle);
    await waitForTaskMarkers(3);

    const markers = document.querySelectorAll('.cm-md-taskMarker');
    expect(markers.length).toBe(3);
    expect(markers[0].classList.contains('cm-md-taskMarker-unchecked')).toBe(true);
    expect(markers[1].classList.contains('cm-md-taskMarker-checked')).toBe(true);
    expect(markers[2].classList.contains('cm-md-taskMarker-checked')).toBe(true);
  });
});
