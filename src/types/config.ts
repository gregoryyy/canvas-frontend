export type YesNo = 'yes' | 'no';

export interface CanvasdSettings {
  mode: string;
  host: string;
  tls: YesNo;
  port: string;
}

export interface LocalStorageSettings {
  mode: string;
  filemenu: YesNo;
}

export interface LayoutSettings {
  precanvas: YesNo;
  canvasclass: string;
  postcanvas: YesNo;
  types: YesNo;
}

export interface Settings {
  canvasd: CanvasdSettings;
  localstorage: LocalStorageSettings;
  layout: LayoutSettings;
}

export interface ConfigMeta {
  type: string;
  version: string;
  date: string;
  canvas: string;
  template: string;
  description: string;
}

export interface CellStructure {
  id: number;
  title: string;
  subtitle?: string;
  description?: string;
  score: YesNo;
}

export interface ScoringRule {
  name: string;
  description: string;
  total: string;
  scores: Record<string, string>;
}

export interface CanvasConfig {
  settings: Settings;
  meta: ConfigMeta;
  scoring: ScoringRule[];
  canvas: CellStructure[];
}

export interface CanvasTypeRef {
  name: string;
  file: string;
}

export type CanvasTypesList = [name: string, file: string][];
