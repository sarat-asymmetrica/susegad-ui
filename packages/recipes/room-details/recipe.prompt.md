# Room details

## The prompt

Build a room card for a homestay's booking page from two library components. Load the room's details from a source with `load(id) → Promise<room>`; for the demo, write a pure, seeded fake source with three rooms (a garden room, a balcão suite and the whole house by the week), a seeded delay where the network would be, and failures only when the page asks for one. Keep the load as a pure state machine (idle, loading, loaded, failed) in which only the latest request may settle the card. While loading, show an `<sg-skeleton busy shape="card" label="the room details">`; when the details arrive, put the card's content inside the skeleton beside its own parts and clear `busy`, so it announces "The room details loaded" and, in warm and playful, inks the outlines in. Show a small painted view from the room in inline SVG with token colours, the name with an `<sg-badge>` for availability ("2 rooms left" as a warning, "Available" as success, "Fully booked" as neutral), who it sleeps and in what beds, the rate in rupees with `Intl.NumberFormat('en-IN')` so ₹1,25,000 reads the Indian way, and what is included. If the load fails, hide the skeleton without clearing `busy`, and show "We couldn’t load the room details. Check your connection and try again." in a `role="alert"` line with a Try again button that moves focus to the card and loads again. Never show the skeleton for a set time and never hide it early. Let the page's register choose the look through the two components: in quiet, flat blocks that give way to the details with a short fade; in warm, the card sketched in pencil and inked in when the details arrive; in playful, soft colour and a wobble on twos while waiting. With reduced motion the details simply appear. Keep availability in words first, with the badge's tone and shape as backup, and offer "Ask about other dates" instead of "Choose your dates" when the room is fully booked. Name the card by its heading once it has one, and make every action a real button.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| a seeded delay where the network would be | fake transport | The source waits through an injected `wait(ms)`: a timer on the page, an instant promise in the tests, with the same seeded delays either way. |
| only the latest request may settle the card | request ids | Each load gets a number; `reduce` ignores an answer whose number is not the current one. |
| put the content inside the skeleton beside its own parts | composition | The skeleton keeps its status line and drawing layer; the recipe appends the content next to them rather than replacing its children. |
| hide the skeleton without clearing `busy` | real arrival | Clearing `busy` means "it arrived". On failure the skeleton is hidden instead, so nothing claims an arrival. |
| `Intl.NumberFormat('en-IN')` | Indian digit grouping | 125000 becomes ₹1,25,000 and 12500000 becomes ₹1,25,00,000, with no hand-written formatting. |
| Let the page's register choose the look | registers | The recipe draws only the painted view. The skeleton and the badge read `data-register` and load their own skins, so one attribute on the page changes the whole card. |
| moves focus to the card | focus management | The button that was pressed goes away while loading, so focus goes to the card (tabindex -1) instead of the page body. |
