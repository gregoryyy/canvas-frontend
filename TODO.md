# Preseed Canvas app

> @author Gregor Heinrich
> @date 20240214  originally created 2023

# TODOs

TODOs with A: are high-priority

* General Design:
  * A: Data management:
    * DOM always updated to system state
    * How to do auto-updates
  * UX harmonized with conventions (dblclick etc.)
  * Multitab: Canvas, analysis, files, settings
* Canvas:
  * List available
  * Load from JSON
  * Save to JSON
  * Download/upload from file
  * Versioning
  * Different canvas types
* Cells:
  * Help overlay on title double click DONE
  * Bug: Only mobile allows single-click new cards
  * Bug: 
* Cards:
  * A: Adjust cell to card DONE
  * A: Card
  * A: Create card
  * A: Remove card
  * Card types in different colors
  * Drag cards up and down
  * Consider TinyMCE as card editor
  * Bug: Double Enter when editing first time
* Precanvas:
  * Ok
* Postcanvas:
  * Bug: Compute score always is 0
  * Compute score from 
  * Visualize partial scores (radar plot etc.)
  * 2 cells with Analysis and Scores

# Apps Ideas

## LLM copilot blog

* Effort and quality analysis
* What did work, what didn't

## App on webpage and IOS app store

* Web-based: APIs on backend for key information (hosted elsewhere)
* Hybrid app on IOS

## Preseed Analyzer: pi-check

AI system to read out the core information and create

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