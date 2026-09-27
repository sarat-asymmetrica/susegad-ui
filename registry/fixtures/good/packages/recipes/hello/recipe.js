import '../../core/index.js';
import '../../scenes/dot/index.js';

/** Put a greeting and a dot scene into a host element. */
export function mountHello(host) {
  host.innerHTML = '<p class="hello">Namaskar</p><sg-scene name="dot"></sg-scene>';
}
