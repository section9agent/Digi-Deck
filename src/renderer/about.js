(async () => {
  const $ = s => document.querySelector(s), info = await about.info();
  $('#ver').textContent = `Version ${info.version} · Electron ${info.electron} · Chromium ${info.chrome} · Node ${info.node}`;
  const li = (c, extra) => { const e = document.createElement('li'), a = document.createElement('a'); a.href = '#'; a.textContent = c.name; a.onclick = ev => { ev.preventDefault(); about.open(c.url); };
    e.append(a, document.createTextNode(' — ' + c.what), ...(extra ? [Object.assign(document.createElement('small'), { textContent: ' (' + extra + ')' })] : [])); return e; };
  info.credits.software.forEach(c => $('#soft').append(li(c, c.license)));
  info.credits.services.forEach(c => $('#svc').append(li(c)));
  $('#donate').onclick = () => about.open(info.donate);
  $('#rel').onclick = e => { e.preventDefault(); about.open(info.repoUrl + '/releases'); };
  $('#auto').checked = info.autoUpdate; $('#auto').onchange = e => about.setAuto(e.target.checked);
  $('#check').onclick = () => about.check();
  $('#lic').onclick = async () => { const p = $('#licText'); if (p.hidden) { p.textContent = await about.licenses(); p.hidden = false; $('#lic').textContent = 'Hide licence texts'; } else { p.hidden = true; $('#lic').textContent = 'Show full licence texts'; } };
})();
