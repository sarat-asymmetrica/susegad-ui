// Folio seal check: choose this document's file and it is hashed here, on this
// device, the same way `folio verify` does. Nothing is sent anywhere.
(() => {
  const meta = document.querySelector('meta[name="folio-integrity"]');
  const input = document.getElementById('folio-check-file');
  const out = document.getElementById('folio-check-result');
  if (!meta || !input || !out) return;
  const digest = meta.content.replace(/^sha256-/, '');
  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    out.textContent = 'Checking…';
    try {
      const text = (await file.text()).split(digest).join('0'.repeat(64));
      const actual = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
      out.textContent = actual === digest
        ? 'This file matches its seal. It has not been changed since it was built.'
        : 'This file does not match its seal. It has been changed since it was built, or it is a different document.';
      out.dataset.result = actual === digest ? 'match' : 'changed';
    } catch {
      out.textContent = "This browser couldn't check the file. Run folio verify on it instead.";
    }
  });
})();
