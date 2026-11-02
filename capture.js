// Executed only in the active LeetCode tab, on an explicit Capture click.
export async function captureSubmission() {
  if (location.hostname !== 'leetcode.com') throw new Error('Open leetcode.com.');
  const match = location.pathname.match(/\/submissions\/(\d+)(?:\/|$)/);
  if (!match) throw new Error('Open the submission you want to capture, then try again.');
  const response = await fetch('/graphql/', {
    method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({operationName:'submissionDetails',variables:{submissionId:Number(match[1])},query:`query submissionDetails($submissionId: Int!) {
      submissionDetails(submissionId: $submissionId) {
        code lang { name verboseName }
        question { questionFrontendId title titleSlug difficulty }
      }
    }`})
  });
  if (!response.ok) throw new Error(`LeetCode request failed (${response.status}).`);
  const body = await response.json();
  const data = body.data?.submissionDetails;
  if (!data?.code || !data.question) throw new Error('Could not read this submission. Sign in to LeetCode or paste manually.');
  return {title:`${data.question.questionFrontendId}. ${data.question.title}`,url:`https://leetcode.com/problems/${data.question.titleSlug}/`,difficulty:data.question.difficulty,language:data.lang.name,code:data.code};
}
