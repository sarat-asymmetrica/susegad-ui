// The Accessibility page: the list of components is open on a desk, where it is read as a table, and folded on a phone,
// where 53 rows are a long scroll; one tap opens it, and a jump to #components opens it too. Without script it stays open.

const list = document.getElementById('components-list');
if (list) {
  list.open = matchMedia('(min-width: 621px)').matches;
  const openIfAsked = () => { if (location.hash === '#components') list.open = true; };
  openIfAsked();
  addEventListener('hashchange', openIfAsked);
}
