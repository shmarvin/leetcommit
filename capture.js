// Executed only in the active LeetCode tab, on an explicit Capture click.
export async function captureSubmission() {
  if (location.hostname !== 'leetcode.com') throw new Error('Open leetcode.com.');
  const match = location.pathname.match(/\/submissions\/(\d+)(?:\/|$)/);
  const problem = location.pathname.match(/^\/problems\/([^/]+)(?:\/|$)/);
  if (!match && !problem) throw new Error('Open a LeetCode problem or submission, then try again.');
  let editorCode, editorLanguage;
  if (!match) {
    // Read complete models, not the virtualized DOM's visible lines or a
    // potentially stale localStorage draft. Ignore detached/testcase models.
    const api=globalThis.monaco?.editor;
    const editors=(api?.getEditors?.() || []).filter(editor=>{
      const node=editor.getDomNode();
      return node?.isConnected && node.getClientRects().length && editor.getModel();
    });
    const models=editors.length ? [...new Set(editors.map(editor=>editor.getModel()))]
      : (api?.getModels?.() || []).filter(model=>model.isAttachedToEditor());
    const codeModels=models.filter(model=>!['plaintext','json'].includes(model.getLanguageId()));
    if(codeModels.length!==1) throw new Error('Could not identify the problem code editor. Open the Code tab and try again, or paste your code manually.');
    editorCode=codeModels[0].getValue();
    editorLanguage=codeModels[0].getLanguageId();
    if(!editorCode.trim()) throw new Error('The problem code editor is empty.');
  }
  const response = await fetch('/graphql/', {
    method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'},
    body:JSON.stringify(match ? {operationName:'submissionDetails',variables:{submissionId:Number(match[1])},query:`query submissionDetails($submissionId: Int!) {
      submissionDetails(submissionId: $submissionId) {
        code lang { name verboseName }
        question { questionFrontendId title titleSlug difficulty }
      }
    }`} : {operationName:'questionData',variables:{titleSlug:problem[1]},query:`query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) { questionFrontendId title titleSlug difficulty }
    }`})
  });
  if (!response.ok) throw new Error(`LeetCode request failed (${response.status}).`);
  const body = await response.json();
  const data = match ? body.data?.submissionDetails : {code:editorCode,lang:{name:editorLanguage},question:body.data?.question};
  if (!data?.code || !data.question) throw new Error('Could not read the problem or submission. Sign in to LeetCode or paste manually.');
  return {title:`${data.question.questionFrontendId}. ${data.question.title}`,url:`https://leetcode.com/problems/${data.question.titleSlug}/`,difficulty:data.question.difficulty,language:data.lang.name,code:data.code};
}
