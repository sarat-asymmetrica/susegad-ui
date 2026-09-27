# 0002: engine budget is 52 KB of source

*Sutradhar, 24 September 2026, Wave 0. Status: accepted.*

The 40 KB engine budget in 0001 counted unminified source including comments. After the split, the engine is 48,409 bytes: about 33 KB of code, the rest JSDoc and module notes that the Wave 0 slice asked for. Because components are copied into a builder's project and read there, the docs are part of what we ship on purpose.

Decision: the engine budget is **52 KB of source** (comments included), and the registry reports the comment-stripped size next to it. Code growth beyond that needs a new decision. Pages import individual `src/*.js` modules when they want less than the whole engine.
