# Decisions — Tomate Extension

## Architectural Choices
<!-- Append new decisions below -->

- The background timer engine is fully alarm-driven: one named alarm tracks phase completion and a second minute-based alarm refreshes badge text, avoiding `setInterval`/`setTimeout` in the service worker.
- Missed-alarm recovery runs on both install and startup, persists the recovered timer state, and records completed work sessions plus celebration state when a work phase elapsed while the worker was inactive.
