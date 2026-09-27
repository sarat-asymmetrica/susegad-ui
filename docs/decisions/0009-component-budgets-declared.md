# 0009: components declare their behaviour budget, like scenes

*Sutradhar, 24 September 2026, Wave 1. Status: accepted.*

0005 gave each component 12 KB of behaviour source (0007: per element). The field note grew to 14.1 KB when it learned to word its messages in the person's terms and to write date limits the way people say dates ("Choose 16 October 2026 or later", day before month by default). About 11 KB of that is code; the rest is teaching comments and the words, which ship on purpose (0002).

Decision: as with scenes (0003), a component declares its behaviour budget in `registry.json`. The default is 12 KB per element. A component may declare up to 16 KB per element with a one-line `budget.reason`. Skins stay at 8 KB each. The field note declares 14,336 bytes.
