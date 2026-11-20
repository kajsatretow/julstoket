const $ = id => document.getElementById(id);
const key = 'julplan-2026-v1';
const categories = ['Inköp','Uppgifter','Idéer'];
const form = $('form'), editor = $('editor');
let records = [], view = 'Inköp', editing = null;
function status(message) {
  $('status').textContent = message;
  $('status').hidden = !message;
}
function isRecord(item) {
  return item && ['id','title','date','note','url'].every(field => typeof item[field] === 'string')
    && item.title.trim() && categories.includes(item.category) && typeof item.done === 'boolean'
    && (!item.date || /^\d{4}-\d{2}-\d{2}$/.test(item.date) && Number.isFinite(Date.parse(item.date))
      && new Date(item.date).toISOString().slice(0,10) === item.date)
    && (!item.url || /^https:\/\//i.test(item.url));
}
function readBackup(raw) {
  const backup = JSON.parse(raw);
  if (backup?.version !== 1 || !Array.isArray(backup.records) || !backup.records.every(isRecord)
    || new Set(backup.records.map(item=>item.id)).size !== backup.records.length) throw new Error('Ogiltig backup');
  return backup.records;
}
try {
  const raw = localStorage.getItem(key);
  if (raw !== null) records = readBackup(raw);
} catch { status('Kunde inte läsa sparade poster.'); }
function commit(next, message = '') {
  try { localStorage.setItem(key, JSON.stringify({version:1,records:next})); }
  catch { status('Kunde inte spara. Kontrollera webbläsarens lagring.'); return false; }
  records = next;
  status(message);
  render();
  return true;
}
function element(tag, text) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}
const dateFormat = new Intl.DateTimeFormat('sv-SE',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const dateLabel = date => dateFormat.format(new Date(date));
function render() {
  const timeline = view === 'Tidsplan';
  document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-current',String(button.dataset.view===view)));
  $('heading').textContent = view;
  const items = records.filter(item=>timeline ? item.date : item.category===view)
    .sort((a,b)=>(timeline ? 0 : Number(a.done)-Number(b.done)) ||
      (a.date || '9999').localeCompare(b.date || '9999'));
  $('count').textContent = timeline ? 'Poster med datum' : view==='Idéer' ? 'Ej beslutade' :
    items.filter(item=>item.done).length+' av '+items.length+(view==='Inköp'?' köpta':' klara');
  $('list').replaceChildren();
  if (!items.length) $('list').append(element('p','Inga poster här ännu.'));
  for (const item of items) {
    const row = element('article');
    if (item.done) row.className='done';
    if (item.category!=='Idéer') {
      const check = element('input');
      check.type='checkbox';
      check.checked=item.done;
      check.setAttribute('aria-label',(item.category==='Inköp'?'Köpt: ':'Klart: ')+item.title);
      check.onchange=()=>{
        if (!commit(records.map(entry=>entry.id===item.id?{...entry,done:check.checked}:entry))) check.checked=item.done;
      };
      row.append(check);
    }
    const body=element('div');
    body.append(element('strong',item.title));
    const details=[timeline ? item.category : '', item.date ? dateLabel(item.date) : ''].filter(Boolean);
    if (details.length) body.append(element('small',details.join(' · ')));
    if (item.note) body.append(element('p',item.note));
    if (item.url) {
      const link=element('a','Visa produkten');
      link.href=item.url;
      link.target='_blank';
      link.rel='noopener noreferrer';
      body.append(link);
    }
    const edit=element('button','Ändra');
    edit.className='edit';
    edit.setAttribute('aria-label','Ändra '+item.title);
    edit.onclick=()=>openEditor(item);
    row.append(body,edit);
    $('list').append(row);
  }
}
function openEditor(item) {
  editing=item;
  $('editTitle').textContent=item?'Redigera post':'Ny post';
  $('remove').hidden=!item;
  form.elements.title.value=item?.title ?? '';
  form.elements.category.value=item?.category ?? (view==='Tidsplan'?'Uppgifter':view);
  form.elements.date.value=item?.date ?? '';
  form.elements.note.value=item?.note ?? '';
  editor.showModal();
  form.elements.title.focus();
}
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{view=button.dataset.view;render();});
$('add').onclick=()=>openEditor(null);
$('close').onclick=()=>editor.close();
$('remove').onclick=()=>{
  if (editing && confirm('Radera ”'+editing.title+'”?') && commit(records.filter(item=>item.id!==editing.id),'Posten har raderats.')) editor.close();
};
form.onsubmit=event=>{
  event.preventDefault();
  const fields=new FormData(form);
  const title=fields.get('title').trim(),category=fields.get('category');
  if (!title) { form.elements.title.focus(); return; }
  const item={id:editing?.id ?? (crypto.randomUUID?.() ?? Date.now().toString(36)+Math.random().toString(36).slice(2)),
    title,category,date:fields.get('date'),note:fields.get('note').trim(),url:editing?.url ?? '',
    done:editing?.category===category && editing.done};
  if (commit(editing ? records.map(entry=>entry.id===editing.id?item:entry) : [...records,item],'Sparat.')) {
    if (view!=='Tidsplan' || !item.date) view=category;
    editor.close();
    render();
  }
};
$('export').onclick=async()=>{
  const backup=new File([JSON.stringify({version:1,records},null,2)],'julstoket-backup.json',{type:'application/json'});
  if (navigator.canShare?.({files:[backup]})) {
    try {
      await navigator.share({files:[backup]});
      return;
    } catch (error) {
      if (error.name==='AbortError') return;
    }
  }
  const href=URL.createObjectURL(backup);
  const link=element('a');
  link.href=href;
  link.download='julstoket-backup.json';
  link.click();
  setTimeout(()=>URL.revokeObjectURL(href),1000);
};
$('import').onclick=()=>$('file').click();
$('file').onchange=async event=>{
  const input=event.target,file=input.files[0];
  input.value='';
  if (!file) return;
  try {
    const next=readBackup(await file.text());
    if (confirm('Ersätta julplanen med '+next.length+' poster från backupen?')) commit(next,'Backupen har lästs in.');
  } catch { status('Filen är inte en giltig backup för Julstöket.'); }
};
window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  $('install').hidden=false;
  $('install').onclick=async()=>{await event.prompt();$('install').hidden=true;};
});
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(console.error);
