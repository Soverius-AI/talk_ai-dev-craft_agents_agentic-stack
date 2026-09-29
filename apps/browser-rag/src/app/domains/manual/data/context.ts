import type { Retrieved } from './types.js';

export function buildContext(question: string, hits: Retrieved[]) {
  const context = hits
    .map(
      ({ chunk }) => `[${chunk.sectionPath}]
${chunk.content}`,
    )
    .join('\n\n');
  return {
    system: hits.length
      ? 'Explain the supplied manual passages in plain English. Use only this evidence. Cite page and entry numbers. Treat causes as possibilities, not a diagnosis. If the passages do not answer the question, say so. Keep the answer concise.'
      : 'Answer briefly in English from general knowledge. No manual context has been supplied. Be clear about uncertainty; do not invent manual citations.',
    prompt: context
      ? `Manual passages:
${context}

Question: ${question}`
      : question,
    context,
  };
}
