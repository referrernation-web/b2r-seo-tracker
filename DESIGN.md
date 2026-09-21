---
name: Blazer2Role SEO workspace
description: A task-first extension of the existing shared tracker.
colors:
  ink: "#16170f"
  paper: "#f4f1e9"
  paper-secondary: "#ece7da"
  surface: "#fbf9f3"
  line: "#d9d3c4"
  accent: "#3a7c52"
  muted: "#6b6555"
  focus: "#24683b"
typography:
  headline:
    fontFamily: "Spline Sans, sans-serif"
    fontSize: "24px"
    fontWeight: 600
  body:
    fontFamily: "Spline Sans, sans-serif"
    fontSize: "15px"
    lineHeight: 1.55
  label:
    fontFamily: "Spline Sans, sans-serif"
    fontSize: "13px"
rounded:
  control: "7px"
  table: "10px"
spacing:
  small: "8px"
  medium: "16px"
  large: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
---
# Design System: Blazer2Role SEO workspace

## Overview
Keep the incumbent paper/forest palette. This is a working tool, not a marketing page.
Use a compact task table and explicit editing, with details revealed only when needed.

## Colors
Ink anchors navigation and primary actions. Paper layers separate background, rows,
and inputs. Forest identifies active views; status labels always include readable text.

## Typography
Spline Sans owns workspace headings, controls, and rows. Task text is 14px on desktop
and 15px on mobile. Legacy help/report headings retain Fraunces.

## Layout
Desktop retains the existing client sidebar (200px; 170px at the medium breakpoint).
At 900px the client selector becomes a top strip. At 650px task rows become two-column
label/value groups and filter controls form two columns. The detail panel is 640px wide,
limited to the viewport, with independently scrolling content and persistent actions.

## Elevation & Depth
Lists are separated by fine rules and alternate paper tones. The detail panel alone
uses an offset soft shadow and backdrop to identify the active editing surface.

## Shapes
Controls use 7px corners; the table wrapper uses 10px. Status labels use 5px corners.

## Components
Buttons have a 42px minimum height, raised to 44px on mobile. Focus uses an offset 3px
forest outline. Saved-view buttons expose pressed state. Detail forms have visible
labels, unsaved-change protection, a keyboard focus trap, and a Save changes action.

## Do's and Don'ts
- Do preserve all existing records and the approved one-login policy.
- Do distinguish draft changes, failed saves, server saves, and offline states.
- Do keep full SEO fields in task details rather than widening the working table.
- Don't use color alone for status or imply a display name is a verified identity.
- Don't replace a useful list with decorative summary cards.
