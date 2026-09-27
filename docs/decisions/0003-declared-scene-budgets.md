# 0003: scenes declare their own byte budget

*Sutradhar, 24 September 2026, Wave 0. Status: accepted.*

0001 gave every scene 40 KB of source. The Paus port is 57.4 KB: the original plate was already 48 KB, and the port adds three registers, a dusk palette for dark pages, calm zones, honest progress and keyboard wiping. Paus is the heavy scene by design; it is the frame-time baseline for the run.

Decision: each scene declares `budget.jsBytes` in its `registry.json`. The default is 40 KB. A scene may declare up to 64 KB with a one-line reason in its manifest (`budget.reason`). The gate is "within its declared budget" (GOAL.md §4), checked by `registry/build.mjs`. Paus declares 61,440 bytes.
