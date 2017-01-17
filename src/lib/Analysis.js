import Dexie from 'dexie';
import md5 from 'blueimp-md5';
import Papa from 'papaparse';

import BotifySDK from './sdk';
import demos from '../constants/demos';


Promise = Dexie.Promise;
Papa.RemoteChunkSize = 1024 * 1024 * 20; // 20 MB

const EXPORTS = {
  ALL_LINKS: 'ALL_LINKS',
  ALL_URL_DETAILS: 'ALL_URL_DETAILS',
};

export const GROUP_STATUS = {
  FAILED: 1,
  SUCCESS: 0,
  COMPUTING: 2,
};

export const INVALID_REASONS = {
  NOT_EXISTS: 0,
  NO_SEGMENTS: 1,
};


const analysesDB = new Dexie('Analyses');
analysesDB.version(1).stores({
  analyses: 'id',
});

export default class Analysis {
  constructor(id) {
    this.id = id;

    this.db = new Dexie(`Analysis-${id}`);
    this.db.version(1).stores({
      urls: 'id', // url,segment1, segment2, segment3
      links: 'id', // source, destination
      groups: '++id, [groupBy1+groupBy2]',
      groupsNodes: '++, group', // key1, key2, count
      groupsLinks: '++, group', // from, to, count',
    });
  }

  init() {
    return analysesDB.analyses.get(this.id)
    .then((analysis) => {
      this.info = analysis;
      BotifySDK.setEnv(analysis.env);
    });
  }

  /**
   * @param  {Func} notify Called several times wih step done
   * @return {Promise}
   */
  prepare(notify) {
    const status = {
      pages: 0,
      links: 0,
      visualisation: 0,
    };

    return Promise.resolve()
    .then(() => this.init())
    .then(() => this._clearDB())
    // Pages
    .then(() => this._prepareExport(EXPORTS.ALL_URL_DETAILS))
    .then(exportUrl => this._storePagesFromExtract(exportUrl, (nbDone) => {
      status.pages = nbDone / this.info.crawledUrls;
      notify(status);
    }))
    // Links
    .then(() => this._prepareExport(EXPORTS.ALL_LINKS))
    .then(exportUrl => this._storeLinksFromExtract(exportUrl, (nbDone) => {
      status.links = nbDone / this.info.links;
      notify(status);
    }))
    // Prepare first visualisation
    .then(() => this._prepareFirstGroup())
    .then(() => {
      status.visualisation = 1;
      notify(status);
    })
    // Set ready
    .then(() => this._setReady());
  }

  computeGroup(groupBy1, groupBy2) {
    let groupId = null;

    return this.db.groups.add({ groupBy1, groupBy2, status: GROUP_STATUS.COMPUTING })
    .then((newGroupId) => { groupId = newGroupId; })
    .then(() => this._computeGroupNodes(groupId, groupBy1, groupBy2))
    .then(urlsNodeId => this._computeGroupLinks(groupId, urlsNodeId))
    .catch((e) => {
      this.db.groups.update(groupId, { status: GROUP_STATUS.FAILED });
      throw e;
    })
    .then(() => this.db.groups.update(groupId, { status: GROUP_STATUS.SUCCESS }))
    .then(() => groupId);
  }

  getGroup(id) {
    const startTime = new Date();
    return Promise.all([
      this.db.groupsNodes.where('group').equals(id).toArray(),
      this.db.groupsLinks.where('group').equals(id).toArray(),
    ])
    .then(([nodes, links]) => {
      console.log('Group took', new Date() - startTime, 'ms to read from db');
      return { nodes, links };
    });
  }

  getGroups() {
    return this.db.groups.toArray();
  }

  storeImg(img) {
    this.info.img = img;
    return analysesDB.analyses.update(this.id, { img });
  }

  // PRIVATE

  _clearDB() {
    return Promise.all([
      this.db.urls.clear(),
      this.db.links.clear(),
      this.db.groups.clear(),
      this.db.groupsNodes.clear(),
      this.db.groupsLinks.clear(),
    ]);
  }

  _prepareExport(type) {
    if (this.info.exports && this.info.exports[type]) return this.info.exports[type];

    return this._checkIfExportAlreadyExist(type)
    .then((exportUrl) => {
      if (!exportUrl) {
        return this._createExport(type);
      }
      return exportUrl;
    });
  }

  _checkIfExportAlreadyExist(type) {
    return BotifySDK.AnalysisController.getAdvancedExportsAsync({
      username: this.info.owner,
      projectSlug: this.info.projectSlug,
      analysisSlug: this.info.analysisSlug,
      size: 30,
    })
    .then((response) => {
      const job = response.results.find(j => j.advanced_export_type === type);
      // @TODO check expiration
      return job ? job.results.download_url : null;
    });
  }

  _createExport(type) {
    return BotifySDK.AnalysisController.createAdvancedExportAsync({
      username: this.info.owner,
      projectSlug: this.info.projectSlug,
      analysisSlug: this.info.analysisSlug,
      advancedExportQuery: {
        advanced_export_type: type,
        query: {},
      },
    })
    .then(job => job.results.download_url);
  }

  _storePagesFromExtract(pagesUrl, notifyNbDone) {
    let isHeader = true;
    let nbHTMLExtracts = 0;
    let nbLinks = 0;
    let nbUrls = 0;

    return this.db.transaction('rw', this.db.urls, () => {
      return new Promise((resolve, reject) => {
        Papa.parse(pagesUrl, {
          download: true,
          chunk: ({ data }) => {
            const urls = [];
            data.forEach((page) => {
              if (isHeader) {
                isHeader = false;
                nbHTMLExtracts = page.length - 25; // HTML extracts are the first 0-3 columns
                return;
              }
              const url = page[24 + nbHTMLExtracts];
              if (!url) return;

              const nbOutlinks = Number.parseInt(page[17 + nbHTMLExtracts], 10);
              urls.push({
                id: md5(url),
                compliant: page[0 + nbHTMLExtracts] === 'True',
                httpCode: Number.parseInt(page[12 + nbHTMLExtracts], 10),
                responseTime: Number.parseInt(page[7 + nbHTMLExtracts], 10),
                pagerank: Number.parseFloat(page[13 + nbHTMLExtracts], 10),
                pagerankPosition: Number.parseInt(page[14 + nbHTMLExtracts], 10),
                nbInlinks: Number.parseInt(page[16 + nbHTMLExtracts], 10),
                nbOutlinks,
                segment1: page[20 + nbHTMLExtracts],
                segment2: page[21 + nbHTMLExtracts],
                extract1: nbHTMLExtracts > 0 ? page[0] : null,
                extract2: nbHTMLExtracts > 1 ? page[1] : null,
                extract3: nbHTMLExtracts > 2 ? page[2] : null,
                extract4: nbHTMLExtracts > 3 ? page[3] : null,
              });
              nbLinks += nbOutlinks;
              nbUrls++;
            });

            this.db.urls.bulkPut(urls);
            notifyNbDone(nbUrls);
          },
          complete: () => {
            this.info.links = nbLinks;
            resolve();
          },
          error: reject,
          withCredidentials: true,
        });
      });
    });
  }

  _storeLinksFromExtract(linksUrl, notifyNbDone) {
    let isHeader = true;
    let nbLinks = 0;

    return this.db.transaction('rw', this.db.links, () => {
      return new Promise((resolve, reject) => {
        Papa.parse(linksUrl, {
          download: true,
          chunk: ({ data }) => {
            const links = [];

            data.forEach((link) => {
              if (isHeader) {
                isHeader = false;
                return;
              }

              if (link[2] !== 'Internal') return;
              nbLinks++;

              const source = md5(link[0]);
              const destination = md5(link[1]);

              // register link
              links.push({
                id: nbLinks,
                source,
                destination,
              });
            });

            this.db.links.bulkAdd(links);
            notifyNbDone(nbLinks);
          },
          complete: () => {
            this.info.links = nbLinks;
            resolve();
          },
          error: reject,
          withCredidentials: true,
        });
      });
    });
  }

  _setReady() {
    return analysesDB.analyses.update(this.id, {
      links: this.info.links,
      ready: true,
    });
  }

  _prepareFirstGroup() {
    return this.computeGroup('segment1');
  }

  _computeGroupNodeKey(url, groupBy1, groupBy2) {
    const key1 = url[groupBy1] || '';
    const key2 = (groupBy2 && url[groupBy2]) || '';
    return [md5(`${key1}:${key2}`), key1, key2];
  }

  _computeGroupNodes(group, groupBy1, groupBy2) {
    let startTime = new Date();
    let inTime = 0;
    const urlsNodeId = {};
    const nodesId = new Map();    // node key to node id
    const nodesValue = [];

    const computeBatch = (urls, idOffset) => {
      const time = new Date();
      urls.forEach((url) => {
        // Register url in a groupNode
        const [nodeKey, key1, key2] = this._computeGroupNodeKey(url, groupBy1, groupBy2);
        let nodeId = nodesId.get(nodeKey);
        if (!nodeId) {
          if (nodesId.size > 99) {
            throw new Error('To many nodes (>100)');
          }

          nodeId = nodesId.size + idOffset + 1; // make ids start at 1
          nodesId.set(nodeKey, nodeId);
          nodesValue.push({ id: nodeId, group, key1, key2, count: 1 });
        } else {
          nodesValue[nodeId - idOffset - 1].count++;
        }

        // Register url to node
        urlsNodeId[url.id] = nodeId;

        // Can it OOM ? Should be good up to 50k crawled urls
        // urlsNodeId contains one item by crawled url.
        // urlsNodeId key is a String of 32 characters
        //            value is an Integer
        // So 1 item is about 72 bytes (32 * 2 + 8)
        // 50k items is about 3.6MB (72 bytes * 50000) very optimistically
      });
      inTime += new Date() - time;
    };

    return this.db.groupsNodes.count()
    .then((idOffset) => {
      return this.db.urls.toArray()
      .then(urls => computeBatch(urls, idOffset));
    })
    .then(() => {
      const unknownUrls = this.info.knownUrls - this.info.crawledUrls;
      if (unknownUrls > 0) {
        this.nodesValue.push({ id: 'unknown', group, key1: null, key2: null, count: unknownUrls });
      }
    })
    .then(() => {
      console.log('Group nodes took', new Date() - startTime, 'ms to compute, (', inTime, 'ms in js)');
      startTime = new Date();
      return this.db.groupsNodes.bulkAdd(nodesValue);
    })
    .then(() => {
      console.log('Group nodes took', new Date() - startTime, 'ms to store');
      return urlsNodeId;
    });
  }

  _computeGroupLinks(group, urlsNodeId) {
    let startTime = new Date();

    return new Promise((resolve, reject) => {
      const res = [];

      // Prepare workers starters
      const jobs = [];
      for (let i = 1; i <= this.info.links; i += 150000) {
        jobs.push({ startIdx: i, endIdx: i + 150000 });
      }

      let nbStarted = 0;
      let nbDone = 0;
      let err = false;

      const startWorker = (jobIdx) => {
        nbStarted++;
        new Promise((_resolve, _reject) => {
          const w = new Worker('dist/worker-groupLinks.js');
          w.postMessage({
            analysisId: this.id,
            startIdx: jobs[jobIdx].startIdx,
            endIdx: jobs[jobIdx].endIdx,
            urlsNodeId,
          });
          w.onmessage = (e) => {
            w.terminate();
            if (e.data.error) {
              _reject(e.data.error);
            } else {
              _resolve(e.data.result);
            }
          };
        })
        .then((groupsLinks) => {
          nbDone++;
          if (err) return;
          res.push(...groupsLinks);
          if (nbStarted < jobs.length) {
            startWorker(nbStarted);
          }
          if (nbDone >= jobs.length) {
            resolve(res);
          }
        })
        .catch((error) => {
          err = true;
          reject(error);
        });
      };

      for (let i = 0; i < 4 && i < jobs.length; i++) { // Start first workers
        startWorker(i);
      }
    })
    .then((res) => {
      const merged = {};
      res.forEach((item) => {
        const id = `${item.from}:${item.to}`;
        if (!merged[id]) {
          merged[id] = {
            ...item,
            id,
            group,
          };
        } else {
          merged[id].count += item.count;
        }
      });
      return Object.values(merged);
    })
    .then((res) => {
      console.log('Group links tooks', new Date() - startTime, 'ms to compute');
      startTime = new Date();
      return this.db.groupsLinks.bulkAdd(res);
    })
    .then(() => {
      console.log('Group links took', new Date() - startTime, 'ms to store');
    });
  }

}

export function getAnalyses() {
  return analysesDB.analyses.toArray();
}

function extractAnalaysisMeta(url) {
  const splits = url.split('/');
  const tempEnv = splits[2].split('.')[1];

  return {
    env: tempEnv === 'botify' ? 'production' : tempEnv,
    username: splits[3],
    projectSlug: splits[4],
    analysisSlug: splits[5],
  };
}

export function createAnalysis(url) {
  const analysisMeta = extractAnalaysisMeta(url);

  BotifySDK.setEnv(analysisMeta.env);
  return BotifySDK.AnalysisController
  .getAnalysisSummaryAsync(analysisMeta)
  .catch((error) => {
    if (error.status === 404) {
      error = new Error('InvalidAnalysis');
      error.reason = INVALID_REASONS.NOT_EXISTS;
    }
    throw error;
  })
  .then((analysis) => {
    analysis.features.segments = { names: ['test'] };
    if (!analysis.features.segments || !analysis.features.segments.names.length) {
      const error = new Error('InvalidAnalysis');
      error.reason = INVALID_REASONS.NO_SEGMENTS;
      throw error;
    }

    return analysesDB.analyses.add({
      id: analysis.id,
      url,
      env: analysisMeta.env,
      owner: analysisMeta.username,
      projectSlug: analysisMeta.projectSlug,
      analysisSlug: analysisMeta.analysisSlug,
      crawledUrls: analysis.urls_done,
      knownUrls: analysis.urls_done + analysis.urls_in_queue,
      links: null,
      segmentsName: analysis.features.segments.names,
      extractsName: analysis.features.extract ? analysis.features.extract.map(e => e.name) : [],
      ready: false,
    })
    .then(() => new Analysis(analysis.id));
  });
}

export function insertDemos() {
  return Promise.all(demos.map((demo) => {
    return analysesDB.analyses.get(demo.id)
    .then((exist) => {
      if (!exist) {
        return analysesDB.analyses.put(demo);
      }
      return null;
    });
  }));
}
