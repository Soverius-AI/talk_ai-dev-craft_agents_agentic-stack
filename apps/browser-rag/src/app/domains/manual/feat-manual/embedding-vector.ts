import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-embedding-vector',
  template: `
    <details>
      <summary>{{ label() }} · {{ vector().length }} values</summary>
      <p class="hint">First 8 dimensions · rounded for display</p>
      <code>{{ preview() }}</code>
      <details class="full">
        <summary>All {{ vector().length }} values</summary>
        <pre tabindex="0" [attr.aria-label]="label() + ' — full vector'">{{ full() }}</pre>
      </details>
    </details>
  `,
  styles: `
    :host {
      display: block;
      margin: 14px 0;
    }
    details {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      background: var(--soft);
    }
    summary {
      cursor: pointer;
      color: var(--accent);
      font-size: 13px;
      font-weight: 600;
    }
    p {
      font-size: 13px;
      line-height: 1.5;
      margin: 12px 0;
    }
    .hint {
      color: var(--muted);
      font-size: 12px;
    }
    code,
    pre {
      font:
        12px/1.8 ui-monospace,
        monospace;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .full {
      margin-top: 12px;
      background: white;
    }
    pre {
      max-height: 220px;
      overflow-y: auto;
      margin-bottom: 0;
    }
  `,
})
export class EmbeddingVector {
  readonly label = input.required<string>();
  readonly vector = input.required<number[]>();
  readonly preview = computed(
    () =>
      '[' +
      this.vector()
        .slice(0, 8)
        .map((value) => value.toFixed(5))
        .join(', ') +
      ', …]',
  );
  readonly full = computed(() => JSON.stringify(this.vector(), null, 2));
}
