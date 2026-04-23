import type { CanvasState } from './canvas';
import type { CanvasConfig, CanvasTypeRef } from './config';

/**
 * Hand-transcribed samples drawn from public/conf/preseed.json,
 * public/models/example.json, public/conf/configs.json. If the real JSON
 * drifts from these shapes, update the types (not the samples) until both
 * compile.
 */

const _sampleConfig: CanvasConfig = {
  settings: {
    canvasd: { mode: 'off', host: 'unlost.ventures', tls: 'yes', port: '8443' },
    localstorage: { mode: 'manual', filemenu: 'no' },
    layout: { precanvas: 'yes', canvasclass: 'ps-canvas', postcanvas: 'yes', types: 'yes' },
  },
  meta: {
    type: 'Preseed Canvas',
    version: '0.2',
    date: '20240207',
    canvas: 'preseed',
    template: 'preseed_v02',
    description: 'Experimental canvas to assess startups.',
  },
  scoring: [
    {
      name: 'UnlostScore',
      description: 'Balanced criteria score',
      total: 'Product * 3/10 + Market * 1/5 + Progress * 1/5 + Team * 3/10',
      scores: {
        Product: 'score(1) * 1/3 + score(2) * 1/3 + score(7) * 1/3',
        Market: 'score(4) * 1/3 + score(9) * 1/3 + score(5) * 1/3',
        Progress: 'score(3) * 1/2 + score(6) * 1/2',
        Team: 'score(8) * 1',
      },
    },
  ],
  canvas: [
    { id: 1, title: 'Problem', subtitle: 'Why?', description: '...', score: 'yes' },
    { id: 2, title: 'Solution', subtitle: 'What?', description: '...', score: 'yes' },
  ],
};

const _sampleState: CanvasState = {
  meta: {
    title: 'Example Startup',
    description: 'Example company that does x for y.',
    canvas: 'preseed',
    version: '0.2',
    date: '20240207',
  },
  canvas: [
    {
      id: 1,
      cards: [
        { content: 'Problem 1' },
        { content: 'Problem 2 (double-check)', type: 'query' },
      ],
      score: 5,
    },
    { id: 2, cards: [{ content: 'Solution 1' }], score: 3 },
  ],
  analysis: { content: 'Analysis: ...' },
};

const _sampleTypeList: CanvasTypeRef[] = [
  { name: 'Preseed Canvas', file: 'preseed' },
  { name: 'Business Model Canvas', file: 'bmcanvas' },
];

export { _sampleConfig, _sampleState, _sampleTypeList };
