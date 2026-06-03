// talnt. CRM Import — Service Worker
const S = {
  get: key => chrome.storage.local.get(key).then(r => r[key]),
  set: (key, val) => chrome.storage.local.set({ [key]: val }),
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {

        case 'EXTRACT_CANDIDATES': {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tabs[0]) throw new Error('Kein aktiver Tab');
          let result;
          try {
            const res = await chrome.tabs.sendMessage(tabs[0].id, { type: 'EXTRACT_CANDIDATES' });
            result = res;
          } catch(e) {
            // Fallback: inject inline
            const res = await chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              func: () => {
                const results = [], seen = new Set();
                const isXING = window.location.hostname.includes('xing.com');
                if (isXING) {
                  document.querySelectorAll('div[id^="candidate_"]').forEach(card => {
                    const nameLink = card.querySelector('a[data-testid="candidateFullName"]');
                    if (!nameLink) return;
                    const href = nameLink.href.split('?')[0];
                    if (seen.has(href)) return; seen.add(href);
                    const fullName = (nameLink.textContent||'').trim().replace(/\s+/g,' ');
                    if (!fullName) return;
                    const parts = fullName.split(/\s+/);
                    const titleDiv = card.querySelector('.sc-gEkIjz,[class*="dsvFvF"]');
                    const em = titleDiv?.querySelector('em');
                    const jobTitle = (em?em.textContent:(titleDiv?.textContent||'')).trim();
                    const company = (card.querySelector('.sc-fFlnrN,[class*="loTAjD"]')?.textContent||'').trim();
                    let location='';
                    const locDiv=card.querySelector('.sc-kbdlSk,[class*="edtRSh"]');
                    if(locDiv){const spans=[...locDiv.querySelectorAll('span')];const ls=spans.find(s=>{const t=(s.textContent||'').trim();return t.includes(',')&&t.length>3&&t!==company;});location=(ls||spans[spans.length-1])?.textContent?.trim()||'';}
                    results.push({source:'XING',firstName:parts[0]||'',lastName:parts.slice(1).join(' ')||'',fullName,jobTitle,company,location,education:'',experience:'',profileUrl:nameLink.href,email:'',phone:''});
                  });
                } else {
                  document.querySelectorAll('a[data-test-link-to-profile-link]').forEach(link=>{
                    const href=link.href.split('?')[0]; if(seen.has(href))return;
                    const fullName=(link.textContent||'').trim().replace(/\s+/g,' ');
                    if(!fullName||fullName.length<2||fullName.length>80) return;
                    if(fullName.match(/^\d+$/)||fullName.includes('http')) return;
                    seen.add(href);
                    const parts=fullName.split(/\s+/);
                    const article=link.closest('article')||link.closest('li')||link.parentElement?.parentElement?.parentElement?.parentElement;
                    const jobTitle=(article?.querySelector('[data-test-row-lockup-headline]')?.textContent||'').trim().replace(/\s+/g,' ');
                    const location=(article?.querySelector('[data-test-row-lockup-location]')?.textContent||'').trim().replace(/\s+/g,' ');
                    const company=(article?.querySelector('[data-test-current-employer-industry]')?.textContent||'').trim().replace(/^·\s*/,'').trim();
                    results.push({source:'LinkedIn',firstName:parts[0]||'',lastName:parts.slice(1).join(' ')||'',fullName,jobTitle,company,location,education:'',experience:'',profileUrl:link.href,email:'',phone:''});
                  });
                }
                return { candidates: results, source: isXING?'XING':'LinkedIn' };
              }
            });
            result = res?.[0]?.result;
          }
          sendResponse({ ok: true, ...result });
          break;
        }

        case 'CREATE_CANDIDATES': {
          const storedUrl = await S.get('webhook_url');
          const WEBHOOK = storedUrl || 'https://hook.eu2.make.com/1e33hohrk84vh54zaxtnfks0efapdzez';
          const testMode = await S.get('test_mode');
          const results = [];

          for (const candidate of msg.candidates) {
            try {
              const payload = {
                firstName:  candidate.firstName  || '',
                lastName:   candidate.lastName   || '',
                fullName:   candidate.fullName   || '',
                jobTitle:   msg.jobTitleOverride || candidate.jobTitle || '',
                company:    candidate.company    || '',
                location:   candidate.location   || '',
                education:  candidate.education  || '',
                email:      candidate.email      || '',
                phone:      candidate.phone      || '',
                profileUrl: candidate.profileUrl || '',
                source:     candidate.source     || '',
                ownerId:    msg.ownerId          || '',
                ownerName:  msg.ownerName        || '',
              };

              if (testMode) {
                await new Promise(r => setTimeout(r, 200));
                results.push({ name: candidate.fullName, ok: true, test: true });
              } else {
                const res = await fetch(WEBHOOK, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                results.push({ name: candidate.fullName, ok: true });
              }
              await new Promise(r => setTimeout(r, 200));
            } catch(e) {
              results.push({ name: candidate.fullName, ok: false, error: e.message });
            }
          }
          sendResponse({ ok: true, results });
          break;
        }

        case 'SAVE_SETTINGS': {
          if (msg.webhookUrl !== undefined) await S.set('webhook_url', msg.webhookUrl);
          if (msg.testMode !== undefined) await S.set('test_mode', msg.testMode);
          sendResponse({ ok: true });
          break;
        }

        case 'GET_SETTINGS': {
          const webhookUrl = await S.get('webhook_url') || '';
          const testMode = await S.get('test_mode') || false;
          sendResponse({ ok: true, webhookUrl, testMode });
          break;
        }
      }
    } catch(e) {
      sendResponse({ ok: false, error: e.message });
    }
  })();
  return true;
});

chrome.runtime.onInstalled.addListener(() => console.log('[talnt.CRM] ready'));
