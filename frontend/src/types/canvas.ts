export type CardType = 'query' | 'comment' | 'analysis' | 'emphasis';

export interface Card {
  content: string;
  type?: CardType;
}

export interface Cell {
  id: number;
  cards?: Card[];
  /**
   * The legacy runtime stores a number initially (from JSON) and a string
   * after the scoring `<select>` change handler runs. Union kept for 1:1
   * compat; phase 2 can narrow once the dropdown handler coerces on write.
   */
  score?: number | string;
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
