# Preseed Canvas app

> @author Gregor Heinrich
> @date 20240214  originally created 2023

# TODOs

TODO fix 1.3.2:

* TODO: in LS export, each canvas is a string with json structures escaped --> create full json structure --> DONE
* BUG: edit cards leads to &amp;nbsp; which causes check() to fail (and no load)
* BUG: canvas types that don't show description or analytics don't wipe those fields when converted
* BUG: product vision board shows vision cards not centered in the middle


TODOs with A: are high-priority

* General Design:
  * A: Data management: DONE v1.1
    * DOM always updated to system state DONE
    * How to do auto-updates --> timer
  * UX harmonized with conventions (dblclick etc.) DONE v1.1
  * Style adjusted, e.g., using tailwindcss.com --> not needed
  * Formatted card content --> 1.2.2 ui text
    * version 1: card.text = text with BR and NL conversion for update/render,
      rendering pipeline: text --> convertNL --> sanitize --> elem.innerHTML
      updating pipeline: elem.innerHTML --> convertBR --> sanitize --> card.text
      BUG: DOMPurify strips br
    * version 2: card.text = markdown = storage and edit format (textarea for edit, 
      rendering pipeline: marked.parse --> sanitize --> elem.innerHTML.
  * Background DONE
  * Add long press as interaction DONE
  * Multitab: Canvas, analysis, files, settings --> TODO v1_2_x
  * Multiple canvases in local storage --> v1_2_2_multicanvas
    * Load menu
* Canvas:
  * List available --> TODO v1_2_x
  * Load from JSON --> localstorage DONE
  * Save to JSON --> localstorage DONE
  * Download/upload from file --> branch v1_1_2_upload
    * inluding server: /devel/canvas-backend
  * Versioning --> via naming (v1_2_2_multicanvas)
  * Different canvas types --> v1_2_5_dynamic_layout
    * Load/save typed canvas
    * Type string below canvas
  * create local canvas with get string:
    * use bzip2 or fflate.js --> v2?
* Cells:
  * Help overlay on title double click DONE
  * BUG: Only mobile allows single-click new cards FIXED
  * prevent browser standard behaviour for double click and touch (select, overlay)
* Cards:
  * A: Adjust cell to card DONE
  * A: Edit card DONE
  * A: Create card DONE
  * A: Remove card DONE
  * Card types in different colors --> v1_1_2_cardtypes DONE
  * Drag cards up and down --> v1_2_2_ui_dragdrop --> v1_3_1_dragdrop
    * only for desktop DONE
  * Consider TinyMCE as card editor --> not needed yet
  * BUG: Double Enter when editing first time FIXED
  * BUG: All newlines get removed on save/load
* Precanvas:
  * Load from instance not preseed.json DONE
* Postcanvas:
  * BUG: Compute score always is 0 FIXED
  * Visualize partial scores (radar plot etc.)
  * 2 cells with Analysis and Scores

# Apps Ideas

## App on webpage and IOS app store

* Web-based: APIs on backend for key information (hosted elsewhere)
* Hybrid app on IOS

## LLM copilot blog

* Effort and quality analysis of developing
* What did work, what didn't
* Insights into capabilities of GPT
* With pi-check analyzer (below), report usage results

## Preseed Analyzer: pi-check

AI system to read out the core information and create an interactive analysis of the decks.

* Input: 
  * Initial: PDF of pitch deck and other documents
  * Initial: LLM-internal general knowledge
  * Initial/Interaction: RAG-derived facts
    * Linkedin profiles
    * Company webpages: Startup, customers, competition
    * Market and trend reports
  * Initial: General investment hypotheses and constraints
    * Industry
    * Type of business
    * Progress
    * --> requires investor-specific finetuning (existing portfolio and documentation)
  * Iteration: Command annotations by user
  * Iteration: Meeting notes
* Processing:
  * Parse content
  * Analyze input information
  * Map information to Preseed Canvas categories
  * Process user annotations
* Interaction: 
  * Annotations
  * Scores
  * Iterative look --> Annotate
* Output:
  * Preseed canvas filled
    * Types of cards: 
      * Analyzed pitch deck
      * External information
      * User annotation
  * Additional documents generated:
    * Pitch deck (canvas to pitch deck)
    * Questions to fulfil all information
    * Analyses:
      * SWOT / TOWS
      * 7 Powers on business
      * 5 Forces of industry
      * Opportunity 
    * AI Suggestions

