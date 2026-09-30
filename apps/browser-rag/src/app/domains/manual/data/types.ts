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

export interface IndexedChunk extends Chunk {
  embedding: number[];
}

export interface RagIndex {
  embeddingModel: string;
  dim: number;
  chunks: IndexedChunk[];
}

export interface Retrieved {
  chunk: Chunk;
  embedding: number[];
  score: number;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export type I18nParams = Record<string, string | number>;
