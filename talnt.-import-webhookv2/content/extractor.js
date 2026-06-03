// talnt. CRM Import — Content Script
(function() {
  if (window.__talntCRMExtractor) return;
  window.__talntCRMExtractor = true;

  function extractXING() {
    const results = [], seen = new Set();
    document.querySelectorAll('div[id^="candidate_"]').forEach(card => {
      const nameLink = card.querySelector('a[data-testid="candidateFullName"]');
      if (!nameLink) return;
      const profileBase = nameLink.href.split('?')[0];
      if (seen.has(profileBase)) return; seen.add(profileBase);
      const fullName = (nameLink.textContent || '').trim().replace(/\s+/g, ' ');
      if (!fullName) return;
      const parts = fullName.split(/\s+/);
      const titleDiv = card.querySelector('.sc-gEkIjz,[class*="dsvFvF"]');
      const em = titleDiv?.querySelector('em');
      const jobTitle = (em ? em.textContent : (titleDiv?.textContent || '')).trim();
      const companySpan = card.querySelector('.sc-fFlnrN,[class*="loTAjD"]');
      const company = (companySpan?.textContent || '').trim();
      let location = '';
      const locDiv = card.querySelector('.sc-kbdlSk,[class*="edtRSh"]');
      if (locDiv) {
        const spans = [...locDiv.querySelectorAll('span')];
        const locSpan = spans.find(s => { const t = (s.textContent||'').trim(); return t.includes(',') && t.length > 3 && t !== company; });
        location = (locSpan || spans[spans.length-1])?.textContent?.trim() || '';
      }
      results.push({ source:'XING', firstName:parts[0]||'', lastName:parts.slice(1).join(' ')||'', fullName, jobTitle, company, location, education:'', experience:'', profileUrl:nameLink.href, email:'', phone:'' });
    });
    return results;
  }

  function extractLinkedIn() {
    const results = [], seen = new Set();
    document.querySelectorAll('a[data-test-link-to-profile-link]').forEach(link => {
      const href = link.href.split('?')[0];
      if (seen.has(href)) return;
      const fullName = (link.textContent || '').trim().replace(/\s+/g, ' ');
      if (!fullName || fullName.length < 2 || fullName.length > 80) return;
      if (fullName.match(/^\d+$/) || fullName.includes('http')) return;
      seen.add(href);
      const parts = fullName.split(/\s+/);
      const article = link.closest('article') || link.closest('li') || link.parentElement?.parentElement?.parentElement?.parentElement;
      const jobTitle = (article?.querySelector('[data-test-row-lockup-headline]')?.textContent || '').trim().replace(/\s+/g, ' ');
      const location = (article?.querySelector('[data-test-row-lockup-location]')?.textContent || '').trim().replace(/\s+/g, ' ');
      const company = (article?.querySelector('[data-test-current-employer-industry]')?.textContent || '').trim().replace(/^·\s*/, '').trim();
      results.push({ source:'LinkedIn', firstName:parts[0]||'', lastName:parts.slice(1).join(' ')||'', fullName, jobTitle, company, location, education:'', experience:'', profileUrl:link.href, email:'', phone:'' });
    });
    return results;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'EXTRACT_CANDIDATES') {
      const isXING = window.location.hostname.includes('xing.com');
      const results = isXING ? extractXING() : extractLinkedIn();
      sendResponse({ candidates: results, source: isXING ? 'XING' : 'LinkedIn' });
    }
    return true;
  });
  console.log('[talnt.CRM] Extractor bereit');
})();
