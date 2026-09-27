# 0007: a component with several elements gets 12 KB of behaviour per element

*Sutradhar, 24 September 2026, Wave 1. Status: accepted.*

0005 gives a component 12 KB of behaviour source. Toast is two elements, `<sg-toast-region>` (the queue, live regions, WCAG 2.2.1 timing, the pile, the hotkey) and `<sg-toast>` (one letter). Its behaviour is 21.9 KB with comments, about 17 KB without.

Decision: a component that defines more than one custom element may declare up to 12 KB of behaviour per element, with the reason in its manifest. Skins stay at 8 KB each. Toast declares 24 KB.
