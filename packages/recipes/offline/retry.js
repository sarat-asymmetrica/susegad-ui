// The offline page's two buttons. Try again reloads the page that was asked for (the address in the bar is
// still the real one); Back goes to the page before. Both are hidden in the markup and shown here, so a
// browser that cannot run this never shows a button that does nothing. Back is shown only when there is
// somewhere to go back to.
const retry = document.querySelector('[data-offline="retry"]');
const back = document.querySelector('[data-offline="back"]');
if (retry) { retry.hidden = false; retry.addEventListener('click', () => location.reload()); }
if (back && history.length > 1) { back.hidden = false; back.addEventListener('click', () => history.back()); }
