import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULT_MAX_CHARS = 1200;

export interface Chunk {
  id: string;
  documentId: string;
  title: string;
  url: string;
  sectionId: string;
  parentSectionId: string | null;
  sectionPath: string;
  depth: number;
  position: number;
  content: string;
  tokenCount: number;
}

interface Section {
  index: number;
  parentIndex: number | null;
  headings: string[];
  depth: number;
  content: string;
}

const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

export function loadChunks(
  corpusDir: string,
  { maxChars = DEFAULT_MAX_CHARS }: { maxChars?: number } = {},
): Chunk[] {
  const files = readdirSync(corpusDir)
    .filter((f) => f.endsWith('.md'))
    .sort();
  const chunks: Chunk[] = [];
  let n = 0;
  for (const file of files) {
    const documentId = file.replace(/\.md$/, '');
    const { url, body } = parseFrontmatter(readFileSync(join(corpusDir, file), 'utf8'));
    let position = 0;
    for (const section of parseMarkdown(body)) {
      const text = section.content.trim();
      if (text.length < 20) continue;
      const title = section.headings[0] ?? documentId;
      const sectionId = `${documentId}#s${section.index}`;
      const parentSectionId =
        section.parentIndex === null ? null : `${documentId}#s${section.parentIndex}`;
      const sectionPath = section.headings.join(' > ');
      for (const piece of splitToBudget(text, maxChars)) {
        chunks.push({
          id: `chunk-${n++}`,
          documentId,
          title,
          url,
          sectionId,
          parentSectionId,
          sectionPath,
          depth: section.depth,
          position: position++,
          content: piece,
          tokenCount: estimateTokens(piece),
        });
      }
    }
  }
  return chunks;
}

function parseFrontmatter(raw: string): { url: string; body: string } {
  const lines = raw.split('\n');
  const url = lines[1].slice('url: '.length).trim();
  return { url, body: lines.slice(3).join('\n') };
}

function parseMarkdown(markdown: string): Section[] {
  const sections: Section[] = [];
  const stack: { index: number; title: string }[] = [];
  let current: Section | null = null;
  let counter = 0;
  for (const line of markdown.split('\n')) {
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      if (current) sections.push(current);
      const level = heading[1].length;
      while (stack.length >= level) stack.pop();
      const parentIndex = stack.length ? stack[stack.length - 1].index : null;
      const index = counter++;
      stack.push({ index, title: heading[2].trim() });
      current = {
        index,
        parentIndex,
        headings: stack.map((node) => node.title),
        depth: stack.length,
        content: '',
      };
    } else if (current) {
      current.content += line + '\n';
    }
  }
  if (current) sections.push(current);
  return sections;
}

function splitToBudget(text: string, maxChars: number): string[] {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= maxChars) return [oneLine];
  const sentences = oneLine.split(/(?<=[.!?])\s+/);
  const pieces: string[] = [];
  let buffer = '';
  for (const sentence of sentences) {
    if (buffer && buffer.length + 1 + sentence.length > maxChars) {
      pieces.push(buffer.trim());
      buffer = '';
    }
    buffer += (buffer ? ' ' : '') + sentence;
  }
  if (buffer.trim()) pieces.push(buffer.trim());
  return pieces;
}
