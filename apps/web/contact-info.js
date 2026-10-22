/* Public contact details for the marketing pages, loaded from GET /api/contact (server BUSINESS_* configuration).
   Elements marked data-contact="…" stay hidden until a real value exists; nothing is hardcoded here.
   Values are assigned with textContent / href properties only, never as HTML. */
(function () {
  // These pages style some contact elements with display:flex, which would otherwise override the hidden attribute.
  const style = document.createElement('style');
  style.textContent = '[hidden]{display:none!important}';
  document.head.append(style);
  const show = (el) => { el.hidden = false; };
  window.safarContact = fetch('/api/contact', { credentials: 'same-origin' })
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null)
    .then((contact) => {
      const c = contact || {};
      document.querySelectorAll('[data-contact]').forEach((el) => {
        const kind = el.dataset.contact;
        if (kind === 'phone-link' && c.phone) { el.href = 'tel:+' + c.phone.replace(/[^0-9]/g, ''); show(el); }
        else if (kind === 'phone' && c.phone) { el.textContent = c.phone; show(el); }
        else if (kind === 'whatsapp-link' && c.whatsapp) { el.href = 'https://wa.me/' + c.whatsapp; el.rel = 'noopener noreferrer'; show(el); }
        else if (kind === 'email-link' && c.email) { el.href = 'mailto:' + c.email; el.textContent = c.email; show(el); }
        else if (kind === 'address' && c.address) { el.textContent = c.address; show(el); }
        // *-label elements (headings, buttons) are only shown when the matching detail exists; their text is static.
        else if (kind.endsWith('-label') && c[kind.slice(0, -6)]) show(el);
        else if (kind === 'any' && (c.phone || c.email || c.address)) show(el);
        else if (kind === 'unavailable' && !c.phone && !c.email && !c.address) show(el);
      });
      return c;
    });

  // Contact page enquiry form (moved out of an inline onclick so pages work under a CSP without 'unsafe-inline').
  document.addEventListener('click', (event) => {
    if (!event.target.closest('#cnt-submit')) return;
    const value = (id) => (document.getElementById(id)?.value || '').trim();
    const name = value('cnt-name'), phone = value('cnt-phone'), service = value('cnt-service'), msg = value('cnt-msg');
    if (!name || !phone) { alert('Please enter your name and phone number.'); return; }
    const text = `*New Contact Enquiry - Safar Self Drive*\n\n*Name:* ${name}\n*Phone:* ${phone}\n*Service:* ${service}\n*Message:* ${msg || 'None'}`;
    window.safarContact.then((c) => {
      if (!c || !c.whatsapp) { alert('WhatsApp enquiries are not available yet.'); return; }
      window.open('https://wa.me/' + c.whatsapp + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
    });
  });
})();
