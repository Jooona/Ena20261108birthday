(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && !reduceMotion) {
    document.documentElement.classList.add('js');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
  }

  const progress = document.querySelector('.reading-progress');
  let scheduled = false;
  const updateProgress = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0})`;
    scheduled = false;
  };
  window.addEventListener('scroll', () => {
    if (!scheduled) {
      scheduled = true;
      window.requestAnimationFrame(updateProgress);
    }
  }, { passive: true });
  window.addEventListener('resize', updateProgress);
  window.addEventListener('load', updateProgress);
  updateProgress();

  const button = document.querySelector('.letter-button');
  const letter = document.getElementById('secret-letter');
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    letter.hidden = expanded;
    button.querySelector('.button-label').textContent = expanded ? '手紙をひらく' : '手紙をとじる';
    if (!expanded) {
      letter.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth', block: 'nearest' });
    }
  });
})();

// The destination is stored only as encrypted data. Never persist the passphrase.
(() => {
  const form = document.getElementById('stay-form');
  const input = document.getElementById('stay-passphrase');
  const status = document.getElementById('stay-status');
  const details = document.getElementById('stay-details');
  const submit = form.querySelector('[type="submit"]');
  const toggle = document.getElementById('stay-toggle');
  toggle.addEventListener('click', () => {
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    toggle.textContent = visible ? '隠す' : '表示';
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.setAttribute('aria-label', visible ? '合言葉を隠す' : '合言葉を表示する');
  });
  const decode = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    if (!window.crypto?.subtle) {
      status.textContent = 'このブラウザでは開けません。最新のブラウザで公開ページを開いてみてね。';
      return;
    }
    submit.disabled = true;
    status.textContent = '小さな鍵を、確かめています…';
    let payload;
    try {
      const response = await fetch('assets/stay.enc.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Destination not available');
      payload = await response.json();
    } catch {
      status.textContent = 'お手紙を読み込めませんでした。少し待って、もう一度試してね。';
      submit.disabled = false;
      return;
    }
    try {
      const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(input.value.normalize('NFKC').trim()), 'PBKDF2', false, ['deriveKey']);
      const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: decode(payload.salt), iterations: 600000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(payload.iv) }, key, decode(payload.ciphertext));
      const stay = JSON.parse(new TextDecoder().decode(plaintext));
      const url = new URL(stay.url);
      if (url.protocol !== 'https:') throw new Error('Invalid destination');
      const eyebrow = document.createElement('span');
      eyebrow.className = 'eyebrow';
      eyebrow.textContent = 'WELCOME TO OUR SECRET STAY';
      const title = document.createElement('h3');
      title.textContent = stay.name;
      const message = document.createElement('p');
      message.textContent = stay.message;
      const link = document.createElement('a');
      link.href = url.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = '宿の公式サイトを見る ↗';
      const close = document.createElement('button');
      close.type = 'button';
      close.textContent = '秘密の扉をとじる';
      close.addEventListener('click', () => {
        details.hidden = true;
        details.replaceChildren();
        form.hidden = false;
        status.textContent = '';
        input.focus();
        updateProgressAfterReveal();
      });
      details.replaceChildren(eyebrow, title, message, link, close);
      input.value = '';
      input.type = 'password';
      toggle.textContent = '表示';
      toggle.setAttribute('aria-pressed', 'false');
      toggle.setAttribute('aria-label', '合言葉を表示する');
      form.hidden = true;
      details.hidden = false;
      details.focus({ preventScroll: true });
      details.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' });
      updateProgressAfterReveal();
    } catch {
      status.textContent = '合言葉が少し違うみたい。もう一度、確かめてみてね。';
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    } finally {
      submit.disabled = false;
    }
  });
  input.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    status.textContent = '';
  });
  function updateProgressAfterReveal() {
    window.dispatchEvent(new Event('resize'));
  }
})();
