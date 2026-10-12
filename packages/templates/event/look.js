// Lets the address pick a look: ?register=quiet|warm|playful and ?theme=light|dark.
// Nothing else reads the address. A plain script in the head, so the look is set
// before the first paint, and an external file, so a strict Content-Security-Policy is fine.
for (const [k, v] of new URLSearchParams(location.search)) {
  if ((k === 'register' || k === 'theme') && /^[a-z]+$/.test(v)) document.documentElement.setAttribute('data-' + k, v);
}
