import Dexie from 'dexie';
import md5 from 'blueimp-md5';
import Papa from 'papaparse';

import BotifySDK from './sdk';


Promise = Dexie.Promise;

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

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}


//  <analysisId>_groups_<groupBy1>_<groupBy2>
//    id, group1, group2, nbUrls, nbCompliant, nbNotCompliant, avgDepth, avgResponseTime,
//    nb2xx, nb3xx, nb4xx, nb5xx, nbInlinks, nbOutlinks, avgPageRank,
//    avgVisits, sumVisits, avgCrawls, sumCrawls

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
      links: '++id', // destination
      groups: '++id, [groupBy1+groupBy2]',
      groupsNodes: 'id, group', // key1, key2, count
      groupsLinks: 'id, group', // from, to, count',
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

  computeGroup(groupBy1, groupBy2, followType) {
    const followValue = followType === 'Follow' ? 1
                       : followType === 'NoFollow' ? 0
                       : null;
    let groupId = null;

    return this.db.groups.add({ groupBy1, groupBy2, status: GROUP_STATUS.COMPUTING })
    .then((newGroupId) => { groupId = newGroupId; })
    .then(() => this._computeGroupNodes(groupId, groupBy1, groupBy2))
    .then(urlsNodeId => this._computeGroupLinks(groupId, followValue, urlsNodeId))
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
    return this._checkIfExportAlreadyExist(type)
    .then((exportUrl) => {
      if (!exportUrl) {
        // return this._createExport(type); // workaround
        throw new Error('No export available');
      }
      return exportUrl;
    })
    .then(this._fixExportUrl); // workaround
  }

  /**
   * https://X/advanced_exports/Y
   * to
   * https://X/advanced_exports/fixed/Y
   */
  _fixExportUrl(exportUrl) {
    return exportUrl.replace('advanced_exports', 'advanced_exports/nogzip')
                    .replace('csv.gz', 'csv');
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

              const nbInlinks = Number.parseInt(page[16 + nbHTMLExtracts], 10);
              urls.push({
                id: md5(url),
                compliant: page[0 + nbHTMLExtracts] === 'True',
                httpCode: Number.parseInt(page[12 + nbHTMLExtracts], 10),
                responseTime: Number.parseInt(page[7 + nbHTMLExtracts], 10),
                pagerank: Number.parseFloat(page[13 + nbHTMLExtracts], 10),
                pagerankPosition: Number.parseInt(page[14 + nbHTMLExtracts], 10),
                nbInlinks,
                nbOutlinks: Number.parseInt(page[17 + nbHTMLExtracts], 10),
                segment1: page[20 + nbHTMLExtracts],
                segment2: page[21 + nbHTMLExtracts],
                extract1: nbHTMLExtracts > 0 ? page[0] : null,
                extract2: nbHTMLExtracts > 1 ? page[1] : null,
                extract3: nbHTMLExtracts > 2 ? page[2] : null,
                extract4: nbHTMLExtracts > 3 ? page[3] : null,
              });
              nbLinks += nbInlinks;
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
                source,
                destination,
                follow: link[3] === 'Follow' ? 1 : 0,
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
    const urlsNodeId = new Map();
    const nodesId = new Map();    // node key to node id
    const nodesValue = [];

    return this.db.groupsNodes.count()
    .then(idOffset => this.db.urls.each((url) => {
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
      urlsNodeId.set(url.id, nodeId);

      // Can it OOM ? Should be good up to 50k crawled urls
      // urlsNodeId contains one item by crawled url.
      // urlsNodeId key is a String of about 60 character
      //            value is an Integer
      // So 1 item is about 128 bytes (60 * 2 + 8)
      // 50k items is about 60MB (128 bytes * 50000)
    }))
    .then(() => {
      const unknownUrls = this.info.knownUrls - this.info.crawledUrls;
      if (unknownUrls > 0) {
        this.nodesValue.push({ id: 'unknown', group, key1: null, key2: null, count: unknownUrls });
      }
    })
    .then(() => {
      console.log('Group nodes took', new Date() - startTime, 'ms to compute');
      startTime = new Date();
      return this.db.groupsNodes.bulkAdd(nodesValue);
    })
    .then(() => {
      console.log('Group nodes took', new Date() - startTime, 'ms to store');
      return urlsNodeId;
    });
  }

  _computeGroupLinks(group, followValue, urlsNodeId) {
    let startTime = new Date();
    const linksId = new Map();
    const linksValue = [];

    let pt = this.db.links;
    if (followValue !== null) {
      pt = pt.where('follow').equals(followValue);
    }

    return this.db.groupsLinks.count()
    .then(offsetId => pt.each((link) => {
      const fromId = urlsNodeId.get(link.source) || 'unknown';
      const toId = urlsNodeId.get(link.destination) || 'unknown';
      const linkKey = md5(`${fromId}:${toId}`);

      let linkId = linksId.get(linkKey);
      if (!linkId) {
        linkId = linksId.size + offsetId + 1; // make ids start at 1
        linksId.set(linkKey, linkId);
        linksValue.push({
          id: linkId,
          group,
          from: fromId,
          to: toId,
          count: 1,
        });
      } else {
        linksValue[linkId - offsetId - 1].count++;
      }
    }))
    .then(() => {
      console.log('Group links took', new Date() - startTime, 'ms to compute');
      startTime = new Date();
      return this.db.groupsLinks.bulkAdd(linksValue);
    })
    .then(() => {
      console.log('Group links took', new Date() - startTime, 'ms to store');
    });
  }

}

export function getAnalyses() {
  return analysesDB.analyses.toArray();
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
