// talnt. CRM Import — Popup
const $ = id => document.getElementById(id);
const S = { get: k => chrome.storage.local.get(k).then(r => r[k]), set: (k,v) => chrome.storage.local.set({[k]:v}) };
const send = msg => chrome.runtime.sendMessage(msg);
const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

let allCandidates = [], selectedCandidates = [];

function toast(msg, type='ok') {
  const t = $('toast');
  t.textContent = msg;
  t.style.cssText = `display:block;background:${type==='ok'?'#052e16':'#2d0a2e'};color:${type==='ok'?'#4ade80':'#f87171'};border:1px solid ${type==='ok'?'#166534':'#7f1d1d'}`;
  setTimeout(() => t.style.display='none', 3000);
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('[id^="tab-"]').forEach(c => c.classList.add('hidden'));
    tab.classList.add('active');
    $(`tab-${tab.dataset.tab}`).classList.remove('hidden');
  });
});

// ── Team / Owner ──────────────────────────────────────────────────────────────
async function loadTeam() {
  const team = await S.get('team_members') || [];
  const myName = await S.get('my_name') || '';
  const myId = await S.get('my_ownerid') || '';

  // Build owner dropdown
  const sel = $('sel-owner');
  sel.innerHTML = '<option value="">— Owner wählen —</option>';
  if (myName) {
    const opt = document.createElement('option');
    opt.value = myId || myName;
    opt.textContent = myName + ' (ich)';
    opt.selected = true;
    sel.appendChild(opt);
  }
  team.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id || m.name;
    opt.textContent = m.name;
    sel.appendChild(opt);
  });

  // Render team list in settings
  renderTeamList(team);
}

function renderTeamList(team) {
  const list = $('team-list');
  if (!team.length) {
    list.innerHTML = '<div style="font-size:11px;color:var(--text3)">Noch keine weiteren Mitglieder</div>';
    return;
  }
  list.innerHTML = team.map((m, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:12px">
      <span style="flex:1;color:var(--text)">${esc(m.name)}</span>
      <span style="color:var(--text3);font-size:11px">${esc(m.id||'')}</span>
      <button onclick="removeMember(${i})" style="background:none;border:none;cursor:pointer;color:#f87171;font-size:14px;padding:0 2px">×</button>
    </div>`).join('');
}

window.removeMember = async function(i) {
  let team = await S.get('team_members') || [];
  team.splice(i, 1);
  await S.set('team_members', team);
  await loadTeam();
  toast('Entfernt');
};

$('btn-add-team').addEventListener('click', async () => {
  const name = $('in-team-name').value.trim();
  const id   = $('in-team-id').value.trim();
  if (!name) { toast('Bitte Namen eingeben', 'err'); return; }
  let team = await S.get('team_members') || [];
  team.push({ name, id });
  await S.set('team_members', team);
  $('in-team-name').value = ''; $('in-team-id').value = '';
  await loadTeam();
  toast(`${name} hinzugefügt ✓`);
});

// ── Profile ───────────────────────────────────────────────────────────────────
$('btn-save-profile').addEventListener('click', async () => {
  const name = $('in-my-name').value.trim();
  const id   = $('in-my-ownerid').value.trim();
  if (!name) { toast('Bitte Namen eingeben', 'err'); return; }
  await S.set('my_name', name);
  await S.set('my_ownerid', id);
  await loadTeam();
  toast('Profil gespeichert ✓');
  $('profile-status').innerHTML = '<span style="color:#4ade80">✓ Gespeichert</span>';
});

// ── Extract ───────────────────────────────────────────────────────────────────
$('btn-extract').addEventListener('click', async () => {
  const btn = $('btn-extract');
  btn.disabled = true; btn.textContent = '⏳ Lade...';
  $('extract-status').textContent = '';

  try {
    const result = await send({ type: 'EXTRACT_CANDIDATES' });
    if (!result?.ok) throw new Error(result?.error || 'Unbekannter Fehler');
    if (!result.candidates?.length) throw new Error('Keine Kandidaten gefunden — XING oder LinkedIn Recruiter öffnen');

    allCandidates = result.candidates;
    selectedCandidates = [...allCandidates];
    renderCandidates();
    $('candidates-section').classList.remove('hidden');
    $('btn-import').disabled = false;
    $('extract-status').innerHTML = `<span style="color:#4ade80">✓ ${allCandidates.length} Kandidaten aus ${result.source} geladen</span>`;
    toast(`${allCandidates.length} Kandidaten geladen ✓`);
  } catch(e) {
    $('extract-status').innerHTML = `<span style="color:#f87171">✗ ${esc(e.message)}</span>`;
    toast(e.message, 'err');
  }
  btn.disabled = false; btn.textContent = '⬇ Kandidaten aus aktivem Tab laden';
});

function renderCandidates() {
  $('candidates-list').innerHTML = allCandidates.map((c, i) => {
    const sel = selectedCandidates.includes(c);
    const tagClass = c.source === 'XING' ? 'tag-xing' : 'tag-li';
    return `<div class="cand-card ${sel?'selected':''}" data-idx="${i}">
      <input type="checkbox" class="cand-cb" data-idx="${i}" ${sel?'checked':''} style="margin-top:2px;accent-color:#8B5CF6;flex-shrink:0">
      <div style="flex:1;min-width:0">
        <div class="cand-name">${esc(c.fullName)}</div>
        <div class="cand-meta">${esc(c.jobTitle||'')}${c.company?' · '+esc(c.company):''}</div>
        <div class="cand-meta">${esc(c.location||'')}</div>
        <span class="tag ${tagClass}">${c.source}</span>
      </div>
    </div>`;
  }).join('');
  updateSelectCount();

  $('candidates-list').querySelectorAll('.cand-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.tagName === 'INPUT') return;
      toggleCandidate(+card.dataset.idx, card);
    });
  });
  $('candidates-list').querySelectorAll('.cand-cb').forEach(cb => {
    cb.addEventListener('change', () => toggleCandidate(+cb.dataset.idx, cb.closest('.cand-card')));
  });
}

function toggleCandidate(i, card) {
  const c = allCandidates[i];
  const idx = selectedCandidates.indexOf(c);
  const cb = card.querySelector('.cand-cb');
  if (idx === -1) { selectedCandidates.push(c); card.classList.add('selected'); if(cb) cb.checked=true; }
  else { selectedCandidates.splice(idx,1); card.classList.remove('selected'); if(cb) cb.checked=false; }
  updateSelectCount();
}

function updateSelectCount() {
  $('select-count').textContent = `${selectedCandidates.length} ausgewählt`;
  $('btn-import').disabled = selectedCandidates.length === 0;
}

$('btn-select-all').addEventListener('click', () => { selectedCandidates = [...allCandidates]; renderCandidates(); });
$('btn-deselect-all').addEventListener('click', () => { selectedCandidates = []; renderCandidates(); });

// ── Import ────────────────────────────────────────────────────────────────────
$('btn-import').addEventListener('click', async () => {
  if (!selectedCandidates.length) { toast('Keine Kandidaten ausgewählt', 'err'); return; }
  const btn = $('btn-import');
  btn.disabled = true; btn.textContent = '⏳ Importiere...';
  $('import-result').classList.remove('hidden');
  $('result-list').innerHTML = '';
  $('progress-fill').style.width = '0%';

  const jobTitle = $('sel-jobtitle').value;
  const ownerVal = $('sel-owner').value;
  const ownerName = $('sel-owner').selectedOptions[0]?.textContent?.replace(' (ich)','') || '';
  const testMode = $('chk-test').checked;
  await S.set('test_mode', testMode);

  try {
    const result = await send({
      type: 'CREATE_CANDIDATES',
      candidates: selectedCandidates,
      ownerId: ownerVal,
      ownerName,
      jobTitleOverride: jobTitle,
    });
    if (!result?.ok) throw new Error(result?.error || 'Fehler');

    const total = result.results.length;
    result.results.forEach((r, i) => {
      $('progress-fill').style.width = `${Math.round((i+1)/total*100)}%`;
      const div = document.createElement('div');
      div.className = 'result-item';
      div.innerHTML = r.ok
        ? `<span style="color:#4ade80">✓</span> <span>${esc(r.name)}</span>${r.test?'<span style="color:#a78bfa;font-size:10px;margin-left:auto">Test</span>':''}`
        : `<span style="color:#f87171">✗</span> <span>${esc(r.name)}</span><span style="color:#f87171;font-size:10px;margin-left:auto">${esc(r.error||'')}</span>`;
      $('result-list').appendChild(div);
    });
    const ok = result.results.filter(r=>r.ok).length;
    toast(`${ok} von ${total} importiert ✓`);
  } catch(e) {
    toast(e.message, 'err');
  }
  btn.disabled = false; btn.textContent = '✓ Ausgewählte in Recruit CRM importieren';
  updateSelectCount();
});

// ── Webhook Settings ──────────────────────────────────────────────────────────
$('btn-save-webhook').addEventListener('click', async () => {
  const url = $('in-webhook-url').value.trim();
  if (!url) { toast('Bitte URL eingeben', 'err'); return; }
  if (!url.startsWith('http')) { toast('Ungültige URL', 'err'); return; }
  await S.set('webhook_url', url);
  toast('Webhook gespeichert ✓');
  $('conn-status').textContent = '✓ Webhook aktiv';
  $('conn-status').className = 'status-badge status-ok';
});

$('btn-test-webhook').addEventListener('click', async () => {
  const url = $('in-webhook-url').value.trim();
  if (!url) { toast('Bitte URL eingeben', 'err'); return; }
  $('test-result').innerHTML = '<span style="color:#a78bfa">Sende Test...</span>';
  try {
    const res = await fetch(url, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ test: true, source: 'talnt. CRM Import', timestamp: new Date().toISOString() })
    });
    $('test-result').innerHTML = res.ok
      ? '<span style="color:#4ade80">✓ Webhook erreichbar</span>'
      : `<span style="color:#f87171">✗ HTTP ${res.status}</span>`;
  } catch(e) {
    $('test-result').innerHTML = `<span style="color:#f87171">✗ ${esc(e.message)}</span>`;
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const webhookUrl = await S.get('webhook_url');
  if (webhookUrl) {
    $('in-webhook-url').value = webhookUrl;
    $('conn-status').textContent = '✓ Webhook aktiv';
    $('conn-status').className = 'status-badge status-ok';
  }
  const testMode = await S.get('test_mode');
  if (testMode) $('chk-test').checked = true;

  const myName = await S.get('my_name') || '';
  const myId = await S.get('my_ownerid') || '';
  if (myName) $('in-my-name').value = myName;
  if (myId) $('in-my-ownerid').value = myId;

  await loadTeam();
}

init();
