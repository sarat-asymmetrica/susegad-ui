# Date range

*Two date inputs that submit on their own, and a calendar that knows the house.*

## The prompt

Build a stay picker as a light-DOM custom element, `<sg-date-range>`, that enhances two labelled native `<input type="date">` fields for arrival and departure inside a fieldset, so the form works and validates without JavaScript through `required`, `min` and `max`. With JavaScript, add a two-month calendar under the inputs that writes into them and follows what is typed. Take availability and prices from pure booking kernels: a night is the night starting on its date, a stay occupies arrival up to departure, guests may leave on the morning others arrive, and no stay may cross a taken night. Make each month a keyboard grid like the WAI-ARIA date picker: one tab stop, arrows by day and week, Home and End to the week's ends, Page Up and Page Down by month and by year with Shift, Enter or Space to pick. Name every day in full with its price in Indian grouping or the reason it cannot be picked, and whether you can leave on it. When the kernels refuse a stay, set the departure input's custom validity to their reason so the form's own validation stops it. Give it three registers: quiet, hairline cells with outlined ends and a tinted stay; warm, the ends looped in hand-drawn ink with an underline under the nights between and a season ribbon above the calendar; playful, the same in bolder laterite ink. Keep the seasons in a plain table too, and draw the ink in full at once under reduced motion.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| enhances two labelled native date inputs | native first | The inputs are the source of truth and what the form submits. The calendar only writes into them and reads from them, so a server can render a chosen stay and it looks the same either way. |
| guests may leave on the morning others arrive | turnover | `classifyDay` asks whether the *previous* night is free, so a day can be taken as a night and still be a departure. The grid marks it with a corner, and its name says "you can leave on this day". |
| no stay may cross a taken night | availability | After an arrival, the furthest departure is found by walking forward until a taken night; days beyond it are disabled but still reachable, so their reason can be heard. |
| a keyboard grid like the WAI-ARIA date picker | roving tabindex | Only one day button has `tabindex="0"`. Keys move focus with a pure `moveFocus`; Page Down keeps the day of the month where it can (31 January goes to 28 February). The view follows focus. |
| set the departure input's custom validity to their reason | constraint validation | The kernels speak the portal's language ("The night of 2026-11-13 is already taken.", "The Christmas band has a 4-night minimum."). `inWords` recognises each reason by its shape and puts it in a guest's words ("The night of 13 November is already taken.", "Stays over Christmas week are at least 4 nights."), then `setCustomValidity` carries that into the browser's own validation bubble, so JavaScript and no-JavaScript rules meet in one place. |
| looped in hand-drawn ink | canvas overlay | A transparent canvas over the months draws a loop a little more than one turn round each end and an underline under each row of nights, then draws in along its length. It never takes a click. |
| a season ribbon above the calendar | texture | The year ahead split into runs by band: rain hatching for the monsoon, a crosshatch for Christmas week, dashed hatching for months not open yet, and the opening flag. The band under your pointer lights up. Token colours are resolved through the browser first, because a canvas cannot read `light-dark()`. |
| keep the seasons in a plain table too | text alternative | The ribbon is decoration; a `details` table lists each season, when it runs, its price range and its minimum stay. |
| takes enquiries before bookings open | `open-from` | The window guests pick from opens on this date (still after the notice period), while the ribbon keeps the rate card's opening flag. Limits the element set itself follow it; limits the page wrote stay. |
| a new rate card redraws | property setter | `rates` is a setter: prices, the ribbon, the season table and the element's own limits all follow it, with no need to touch `blocks`. |
