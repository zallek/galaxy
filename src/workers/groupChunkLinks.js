function openDb(id) {
  return new Promise(function(resolve, reject) {
    var req = indexedDB.open('Analysis-' + id, 10);
    req.onsuccess = function (evt) {
      resolve(this.result);
    };
    req.onerror = function (evt) {
      reject(new Error(`Error while opening db ${evt.target.errorCode}`));
    };
  });
}

function getLinks(db, startIdx, endIdx) {
  return new Promise(function(resolve, reject) {
    var store = db.transaction(['links'], 'readonly').objectStore('links');
    var req = store.getAll(IDBKeyRange.bound(startIdx, endIdx, false, true));
    req.onsuccess = function (evt) {
      resolve(this.result);
    };
    req.onerror = function (evt) {
      reject(new Error(`Error while reading links ${evt.target.errorCode}`));
    };
  });
}

function computeBatch(links, urlsNodeId) {
  const linksId = new Map();
  const linksValue = [];

  links.forEach((link) => {
    const fromId = urlsNodeId[link.source] || 'unknown';
    const toId = urlsNodeId[link.destination] || 'unknown';
    const linkKey = `${fromId}:${toId}`;

    let linkId = linksId.get(linkKey);
    if (!linkId) {
      linkId = linksId.size + 1; // make ids start at 1
      linksId.set(linkKey, linkId);
      linksValue.push({
        from: fromId,
        to: toId,
        count: 1,
      });
    } else {
      linksValue[linkId - 1].count++;
    }
  });

  return linksValue;
}


onmessage = function(e) {
  try {
    openDb(e.data.analysisId)
    .then(db => getLinks(db, e.data.startIdx, e.data.endIdx))
    .then(links => computeBatch(links, e.data.urlsNodeId))
    .then(groupLinks => postMessage({
      error: null,
      result: groupLinks,
    }))
    .catch(error => postMessage({
      error: JSON.stringify(error),
      result: null,
    }));
  } catch (error) {
    postMessage({
      error: JSON.stringify(error),
      result: null,
    });
  }
};
