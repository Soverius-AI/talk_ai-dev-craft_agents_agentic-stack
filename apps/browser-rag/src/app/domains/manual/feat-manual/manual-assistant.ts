import { DecimalPipe } from '@angular/common';
import { EmbeddingVector } from './embedding-vector';
import { Component, inject, signal } from '@angular/core';
import { FormField, form, readonly } from '@angular/forms/signals';
import { ManualStore } from '../data/manual-store';

@Component({
  selector: 'app-manual-assistant',
  imports: [FormField, DecimalPipe, EmbeddingVector],
  host: { '(window:online)': 'online.set(true)', '(window:offline)': 'online.set(false)' },
  template: `
    <header>
      <div class="brand">SOVERIUS <span>AI</span></div>
      <span class="unit">AI DevCraft / 04</span>
      <span class="connection" [class.offline]="!online()">{{
        online() ? 'Online' : 'Offline'
      }}</span>
    </header>
    <main>
      <div class="intro">
        <p class="eyebrow">BROWSER-LOCAL RAG</p>
        <h1>Your manual. Your browser.</h1>
        <p>Find the relevant passage. Let Gemma explain it.</p>
      </div>
      <section class="preparation" aria-label="Local models">
        <div class="models">
          <span
            ><b>{{ store.searchReady() ? '●' : '○' }}</b> E5 · embeddings</span
          >
          <span
            ><b>{{ store.modelReady() ? '●' : '○' }}</b> Gemma 4 · {{ store.device() }}</span
          >
        </div>
        <button (click)="store.prepare()" [disabled]="store.busy() || store.modelReady()">
          {{
            store.modelReady()
              ? 'Models ready'
              : store.loading()
                ? 'Preparing…'
                : 'Prepare local models'
          }}
        </button>
        <p class="status" role="status">{{ store.status() }}</p>
        @if (store.loading()) {
          <progress
            aria-label="Model preparation"
            [attr.value]="store.progress()"
            max="100"
          ></progress>
        }
        @if (store.error()) {
          <p role="alert" class="error">{{ store.error() }}</p>
        }
      </section>
      <form (submit)="ask($event)">
        <label for="question">Ask the Optyma Cooler manual</label>
        <textarea id="question" rows="3" [formField]="questionForm.text"></textarea>
        <div class="actions">
          <label class="toggle"
            ><input
              type="checkbox"
              [checked]="store.useManual()"
              [disabled]="store.busy()"
              (change)="toggleManual($event)"
            />
            Use manual context</label
          >
          <div class="query-buttons">
            <button
              type="button"
              class="secondary"
              (click)="store.findPassages(question().text)"
              [disabled]="
                !store.searchReady() ||
                store.busy() ||
                !question().text.trim() ||
                !store.useManual()
              "
            >
              Find passages
            </button>
            <button
              type="submit"
              [disabled]="!store.modelReady() || store.busy() || !question().text.trim()"
            >
              {{
                store.searching()
                  ? 'Finding passages…'
                  : store.generating()
                    ? 'Generating…'
                    : 'Ask locally'
              }}
            </button>
          </div>
        </div>
      </form>
      <div class="results">
        <section class="panel" aria-labelledby="evidence-title">
          <p class="eyebrow">01 / RETRIEVE</p>
          <h2 id="evidence-title">Manual passages</h2>
          @if (store.hits().length) {
            <p class="vector-hint">
              E5 · 768 dimensions. Higher cosine similarity means a closer match, not a confidence
              percentage.
            </p>
          }
          @for (hit of store.hits(); track hit.chunk.id; let i = $index) {
            <article>
              <div class="source">
                <strong>{{ hit.chunk.sectionPath }}</strong
                ><span>#{{ i + 1 }}</span>
              </div>
              <p class="similarity">
                Cosine similarity: <strong>{{ hit.score | number: '1.4-4' }}</strong>
              </p>
              <p>{{ hit.chunk.content }}</p>
              <app-embedding-vector
                [label]="'Passage vector · result ' + (i + 1)"
                [vector]="hit.embedding"
              />
              <a [href]="hit.chunk.url" target="_blank" rel="noopener"
                >Original manual · page 6 ↗</a
              >
            </article>
          } @empty {
            <p class="empty">
              {{
                store.useManual()
                  ? 'Relevant passages will appear here.'
                  : 'Manual context is off. The model receives only your question.'
              }}
            </p>
          }
        </section>
        <section class="panel" aria-labelledby="answer-title">
          <p class="eyebrow">02 / GENERATE</p>
          <h2 id="answer-title">Gemma’s explanation</h2>
          <p class="answer" [attr.aria-busy]="store.generating()">
            {{ store.answer() || 'The local model will explain the selected passages here.' }}
          </p>
          @if (store.generating()) {
            <span class="streaming" role="status">Generating in your browser…</span>
          }
          @if (store.context()) {
            <details>
              <summary>Context sent to Gemma</summary>
              <pre>{{ store.context() }}</pre>
            </details>
          }
        </section>
      </div>
      <footer>
        Teaching corpus: selected, paraphrased entries from Danfoss Optyma Cooler · p. 6, §13. Each
        question starts fresh.
      </footer>
    </main>
  `,
  styles: `
    :host {
      display: block;
    }
    header {
      display: flex;
      align-items: center;
      gap: 24px;
      padding: 22px 5vw;
      border-bottom: 1px solid var(--line);
      background: white;
    }
    .brand {
      font-size: 20px;
      letter-spacing: 0.12em;
      font-weight: 800;
    }
    .brand span {
      color: var(--accent);
    }
    .unit {
      color: var(--muted);
      font-size: 13px;
    }
    .connection {
      margin-left: auto;
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 6px 14px;
      font-size: 13px;
    }
    .offline {
      color: #9b4600;
      border-color: #db6b00;
    }
    main {
      max-width: 1280px;
      margin: auto;
      padding: 36px 32px;
    }
    .intro {
      margin-bottom: 26px;
    }
    h1 {
      font-size: clamp(30px, 3vw, 44px);
      line-height: 1.15;
      margin: 8px 0 12px;
      letter-spacing: -0.035em;
    }
    .intro > p:last-child {
      color: var(--muted);
    }
    .eyebrow {
      color: var(--accent);
      letter-spacing: 0.12em;
      font-size: 11px;
      font-weight: 800;
      margin: 0 0 8px;
    }
    .preparation {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px 24px;
      background: var(--soft);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 20px;
    }
    .models {
      flex: 1;
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
      font-size: 14px;
    }
    .models b {
      color: var(--accent);
      margin-right: 5px;
    }
    .status {
      width: 100%;
      margin: 0;
      font-size: 13px;
      color: var(--muted);
      overflow-wrap: anywhere;
    }
    progress {
      width: 100%;
      height: 6px;
      accent-color: var(--accent);
    }
    .error {
      color: #a02319;
      margin: 0;
      overflow-wrap: anywhere;
    }
    form {
      margin: 26px 0;
    }
    form > label {
      display: block;
      font-weight: 650;
      margin-bottom: 9px;
    }
    textarea {
      display: block;
      width: 100%;
      resize: vertical;
      padding: 16px;
      border: 1px solid var(--line);
      border-radius: 10px;
      font: inherit;
      font-size: 17px;
      line-height: 1.5;
      background: white;
    }
    .actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-top: 12px;
    }
    .toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--muted);
      font-size: 14px;
    }
    input {
      accent-color: var(--accent);
      width: 18px;
      height: 18px;
    }
    button {
      background: var(--accent);
      color: white;
      padding: 11px 18px;
      border: 0;
      border-radius: 7px;
      font: inherit;
      font-size: 14px;
      font-weight: 650;
      cursor: pointer;
    }
    button:disabled {
      background: #d5dfe6;
      color: #4b5a65;
      cursor: default;
    }
    .query-buttons {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    button.secondary {
      background: white;
      color: var(--accent);
      border: 1px solid var(--line);
    }
    button.secondary:disabled {
      color: var(--muted);
      background: var(--soft);
    }
    .results {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      align-items: start;
    }
    .panel {
      background: white;
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 24px;
      box-shadow: 0 8px 24px #0b151d08;
      min-height: 270px;
    }
    h2 {
      font-size: 23px;
      margin: 0 0 24px;
      letter-spacing: -0.02em;
    }
    article {
      padding: 18px 0;
      border-top: 1px solid var(--line);
    }
    article p {
      font-size: 14px;
      line-height: 1.65;
    }
    .source {
      display: flex;
      gap: 12px;
      justify-content: space-between;
      color: var(--accent);
      font-size: 13px;
    }
    .source span {
      color: var(--muted);
    }
    a {
      color: var(--accent);
      font-size: 12px;
    }
    .vector-hint,
    .similarity {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.6;
    }
    .empty {
      color: var(--muted);
      line-height: 1.6;
      font-size: 14px;
    }
    .answer {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      line-height: 1.75;
      font-size: 16px;
    }
    .streaming {
      color: var(--accent);
      font-size: 13px;
    }
    details {
      border-top: 1px solid var(--line);
      margin-top: 24px;
      padding-top: 16px;
    }
    summary {
      cursor: pointer;
      color: var(--muted);
      font-size: 13px;
    }
    pre {
      white-space: pre-wrap;
      font-size: 12px;
      line-height: 1.65;
    }
    footer {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.7;
      margin: 24px 0 0;
    }
    @media (max-width: 760px) {
      .results {
        grid-template-columns: 1fr;
      }
      main {
        padding: 24px 18px;
      }
      .unit {
        display: none;
      }
      .models {
        flex-basis: 100%;
      }
    }
  `,
})
export class ManualAssistant {
  readonly store = inject(ManualStore);
  readonly online = signal(navigator.onLine);
  readonly question = signal({
    text: 'The cold room warms up when staff keep walking in and out. What does the manual suggest?',
  });
  readonly questionForm = form(this.question, (fields) =>
    readonly(fields.text, () => this.store.busy()),
  );

  ask(event: Event): void {
    event.preventDefault();
    void this.store.ask(this.question().text);
  }

  toggleManual(event: Event): void {
    this.store.useManual.set((event.target as HTMLInputElement).checked);
  }
}
