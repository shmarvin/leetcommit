const groups = [
  ['cpp','//',['c++','cpp','c++11','c++14','c++17','c++20','c++23']],
  ['c','//',['c']], ['py','#',['python','python3']], ['java','//',['java']],
  ['js','//',['javascript']], ['ts','//',['typescript']], ['go','//',['golang','go']],
  ['rs','//',['rust']], ['cs','//',['c#','csharp']], ['rb','#',['ruby']],
  ['swift','//',['swift']], ['kt','//',['kotlin']], ['scala','//',['scala']],
  ['php','//',['php']], ['dart','//',['dart']], ['ex','#',['elixir']],
  ['erl','%',['erlang']], ['r','#',['r']], ['sql','--',['mysql','postgresql','mssql','oraclesql','sql']],
  ['sh','#',['bash','shell']], ['rkt',';',['racket']]
];
export function languageInfo(name) {
  const entry = groups.find(g => g[2].includes(String(name).toLowerCase()));
  if (!entry) throw new Error(`Unsupported language: ${name}. No file was uploaded.`);
  return {extension: entry[0], comment: entry[1]};
}
export function slug(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}
export function parseTitle(value) {
  const m = value.trim().match(/^(\d+)\s*[.:-]\s*(.+)$/);
  if (!m || Number(m[1]) < 1 || !slug(m[2])) throw new Error('Title must look like 1. Two Sum.');
  return {number: String(Number(m[1])), title: m[2].trim()};
}
export function normalizeFolder(value) {
  const path = value.trim().replace(/^\/+|\/+$/g,'');
  if (path && path.split('/').some(p => !p || p === '.' || p === '..' || /[\\\x00-\x1f]/.test(p))) throw new Error('Invalid folder path.');
  return path;
}
export function filePath(draft, folder='') {
  const p = parseTitle(draft.title);
  const approach = slug(draft.approach || '');
  const name = `${p.number.padStart(4,'0')}-${slug(p.title)}${approach ? '-'+approach : ''}.${languageInfo(draft.language).extension}`;
  return [normalizeFolder(folder), name].filter(Boolean).join('/');
}
export function header(title, url, difficulty, language) {
  const c = languageInfo(language).comment;
  const lines = `${c} ${title}\n${c} ${url}\n${c} Difficulty: ${difficulty}\n`;
  return language.toLowerCase() === 'php' ? `<?php\n${lines}?>\n\n` : lines + '\n';
}
export function encodeContent(text) {
  const bytes = new TextEncoder().encode(text);
  let binary=''; for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
export function decodeContent(text) {
  return new TextDecoder().decode(Uint8Array.from(atob(text.replace(/\s/g,'')), c=>c.charCodeAt(0)));
}
export async function commitFile(api, repo, draft, folder) {
  if (!draft.code?.trim()) throw new Error('Code is empty.');
  const path = filePath(draft, folder);
  const metadata = await api(`/repos/${repo}`);
  const branch = metadata.default_branch;
  const endpoint = `/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
  let existing;
  try { existing = await api(`${endpoint}?ref=${encodeURIComponent(branch)}`); }
  catch(e) { if (e.status !== 404) throw e; }
  if (existing && existing.type !== 'file') throw new Error('Destination is not a file.');
  if (existing && decodeContent(existing.content || '') === draft.code) return {unchanged:true,url:existing.html_url};
  const p = parseTitle(draft.title);
  const message = draft.message?.trim() || `${existing?'Update':'Add'} LeetCode ${p.number}: ${p.title}${draft.approach?.trim() ? ` (${draft.approach.trim()})` : ''}`;
  const result = await api(endpoint, {method:'PUT',body:{message,content:encodeContent(draft.code),branch,...(existing?{sha:existing.sha}:{})}});
  return {url:result.content.html_url};
}
