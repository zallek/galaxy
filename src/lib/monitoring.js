import 'whatwg-fetch';


export function sendStats(analysisId, urls, links) {
  fetch('https://66r07ksyuh.execute-api.eu-west-1.amazonaws.com/dev/group-perfs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      analysisId,
      urls,
      links,
    }),
  }).then(() => console.log('stats sent'));
}
