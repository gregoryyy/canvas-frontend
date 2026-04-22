# Canvas Application

Interactive browser-based canvas tool for working with structured strategy and analysis boards such as Preseed Canvas, Lean Canvas, Business Model Canvas, Product Vision Board, SWOT, and TOWS.

The app is implemented as plain ES modules and runs fully in the browser. Canvas state is stored locally in `localStorage`, with optional import/export and optional file-upload integration.

## Features

- Multiple canvas types loaded from JSON configs in `conf/`
- Canvas content loaded from JSON models in `models/`
- Inline editing for title, description, analysis text, cards, and scores
- Create, remove, and reorder cards directly on the board
- Help overlays per cell
- Local persistence via browser `localStorage`
- Export local storage as JSON and export the rendered board as SVG
- Optional upload integration via `network.js`
- Basic Jasmine browser tests

## Project Layout

```text
canvas/
├── index.html            # Main browser entrypoint
├── main.js               # App bootstrap, state, controls
├── canvas.js             # Canvas, cell, card, pre/post canvas logic
├── util.js               # DOM helpers, storage, export, sanitization
├── network.js            # Optional file upload and websocket client
├── canvas.css            # Base component styles
├── layout.css            # Canvas layout styles
├── conf/                 # Canvas definitions and settings
├── models/               # Example and template canvas content
├── lib/                  # Third-party browser libraries
└── test/                 # Jasmine specs
```

## Running Locally

`index.html` references shared site assets from the parent directory (`../styles.css`, `../aurora.js`, `../script.js`, `../unlost.svg`), so serve the parent site root, not the `canvas/` folder by itself.

Example:

```bash
cd ..
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/canvas/
```

## URL Parameters

- `?model=<name>` loads `models/<name>.json`
- `?config=<name>` loads `conf/<name>.json`
- `?debug=true` enables debug logging

Defaults:

- model: `template`
- config: taken from `model.meta.canvas`, or `preseed` if missing

Examples:

```text
/canvas/?model=example
/canvas/?model=template&config=leancanvas
/canvas/?model=test&debug=true
```

## How It Works

At startup, `main.js`:

1. Reads URL parameters.
2. Loads the selected model from `models/`.
3. Loads the matching canvas config from `conf/`.
4. Builds the application state and renders the board.

The main state consists of:

- `meta`: title, description, canvas type
- `canvas`: ordered list of cells and cards
- `analysis`: free-text notes and optional computed score

Canvas type definitions in `conf/*.json` control:

- visible sections
- layout class
- cell titles and help text
- which cells support scoring
- score formulas

## Interaction Model

- Click a card or text field to edit it inline
- Double-click or long-press a cell title to open its help overlay
- Double-click or long-press an empty cell area to create a new card
- Clear a card’s text and blur the field to delete the card
- Drag cards to reorder them or move them between cells
- Use `Ctrl+S` or `Cmd+S` to save to local storage

Card type commands at the start of a card:

- `:?` query
- `:!` comment
- `:=` analysis
- `:*` emphasis
- `:-` reset to default styling

## Storage and Export

The app stores saved canvases in browser `localStorage` under the key `preseedcanvas`.

Available controls:

- `Save to LS`
- `Load from LS`
- `Clear LS`
- `Export LS`
- `Import LS`
- `Export SVG`
- `Canvas Type`
- `Clear Canvas`

The app also attempts an automatic save on page unload when a canvas title exists.

## Data Format

Models in `models/*.json` use this shape:

```json
{
  "meta": {
    "title": "New Startup",
    "description": "Description.",
    "canvas": "preseed",
    "version": "0.2",
    "date": "20240219"
  },
  "canvas": [
    {
      "id": 1,
      "cards": [
        { "content": "Problem" }
      ],
      "score": 0
    }
  ],
  "analysis": {
    "content": "Analysis: ..."
  }
}
```

Canvas configs in `conf/*.json` define settings, scoring, and the ordered cell structure rendered by the app.

## Testing

Browser tests are defined in:

- `test/LoadSpec.js`
- `test/CardSpec.js`
- `test/InteractSpec.js`

Test runner:

```text
/canvas/canvas_test.html?model=test
```

## Notes

- The app is client-side by default; no canvas content is sent to a server unless upload features are explicitly enabled in config.
- Optional upload support is controlled by `conf/*.json` via `settings.canvasd`.
- Sanitization is handled in `util.js` with DOMPurify before content is stored or rendered.
