export type CardType = 'query' | 'comment' | 'analysis' | 'emphasis';

export interface Card {
  content: string;
  type?: CardType;
}

export interface Cell {
  id: number;
  cards?: Card[];
  score?: number;
}

export interface Meta {
  title: string;
  description?: string;
  canvas: string;
  version: string;
  date: string;
}

export interface Analysis {
  content: string;
}

export interface CanvasState {
  meta: Meta;
  canvas: Cell[];
  analysis?: Analysis;
}
