import Dexie from 'dexie';
import md5 from 'blueimp-md5';
import csvParse from 'csv-parse/lib/sync';

import BotifySDK from './sdk';


Promise = Dexie.Promise;

const EXPORTS = {
  ALL_LINKS: 'ALL_LINKS',
  ALL_URL_DETAILS: 'ALL_URL_DETAILS',
};

export const PREPARE_STEPS = {
  LINKS: 0,
  SEGMENTS: 1,
  VISUALISATION: 2,
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
      links: '++id, follow', // destination
      groups: '++id, [groupBy1+groupBy2]',
      groupsNodes: 'id, group', // key1, key2, count
      groupsLinks: 'id, group', // from, to, count',
    });
  }

  /**
   * @param  {Func} notify Called several times wih step done
   * @return {Promise}
   */
  prepare(notify) {
    return Promise.resolve()
    .then(() => this._initSDK())
    .then(() => this._clearDB())
    // Links
    .then(() => this._prepareExport(EXPORTS.ALL_LINKS))
    .then(downloadUrl => this._downloadExport(downloadUrl))
    .then(links => this._storeLinksFromExtract(csvParse(links, { columns: true })))
    .then(() => notify(PREPARE_STEPS.LINKS))
    // Segments
    .then(() => this._prepareExport(EXPORTS.ALL_URL_DETAILS))
    .then(downloadUrl => this._downloadExport(downloadUrl))
    .then(allUrls => this._storeSegmentsFromExtract(csvParse(allUrls, { columns: true })))
    .then(() => notify(PREPARE_STEPS.SEGMENTS))
    // Prepare first visualisation
    .then(() => this._prepareFirstGroup())
    .then(() => notify(PREPARE_STEPS.VISUALISATION))
    // Set ready
    .then(() => this._setReady());
  }

  computeGroup(groupBy1, groupBy2 = '', followType) {
    const followValue = followType === 'Follow' ? 1
                       : followType === 'NoFollow' ? 0
                       : null;
    let group = null;

    return this.db.groups.add({ groupBy1, groupBy2 })
    .then((g) => { group = g; })
    .then(() => this._computeGroupNodes(group, groupBy1, groupBy2))
    .then(urlsNodeId => this._computeGroupLinks(group, groupBy1, groupBy2, followValue, urlsNodeId));
  }

  getGroup(id) {
    return Promise.all([
      this.db.groupsNodes.where('group').equals(id).toArray(),
      this.db.groupsLinks.where('group').equals(id).toArray(),
    ])
    .then(([nodes, links]) => ({ nodes, links }));
  }

  getGroups() {
    return this.db.groups.toArray();
  }

  // PRIVATE

  _initSDK() {
    return analysesDB.analyses.get(this.id)
    .then((analysis) => {
      this.info = analysis;
      BotifySDK.setEnv(analysis.env);
    });
  }

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

  _downloadExport(url) {
    return new Promise((resolve, reject) => {
      const oReq = new XMLHttpRequest();
      oReq.open('GET', url, true);
      oReq.onload = () => {
        resolve(oReq.response);
      };
      oReq.onError = () => {
        reject(new Error(oReq.status));
      };
      oReq.send();
    });
  }

  _addUrl(id, url) {
    return this.db.urls.add({
      id,
      url,
      segment1: '',
      segment2: '',
    });
  }

  _storeLinksFromExtract(links) {
    let nbLinks = 0;
    const urlsId = new Set();

    return this.db.transaction('rw', this.db.urls, this.db.links, () => {
      links.forEach((link) => {
        if (link['Internal / External'] !== 'Internal') return;
        nbLinks++;

        const sourceId = md5(link['Url Source']);
        const destinationId = md5(link['Url Destination']);

        // register urls
        if (!urlsId.has(sourceId)) {
          urlsId.add(sourceId);
          this._addUrl(sourceId, link['Url Source']);
        }
        if (!urlsId.has(destinationId)) {
          urlsId.add(destinationId);
          this._addUrl(destinationId, link['Url Destination']);
        }

        // register link
        this.db.links.add({
          source: sourceId,
          destination: destinationId,
          follow: link['Follow / No-Follow'] === 'Follow' ? 1 : 0,
        });
      });
    })
    .then(() => { this.info.links = nbLinks; });
  }

  _storeSegmentsFromExtract(pages) {
    return this.db.transaction('rw', this.db.urls, () => {
      pages.forEach((page) => {
        const id = md5(page.url);
        this.db.urls.update(id, {
          segment1: page.segment_1 || getRandomInt(0, 20).toString(),
          segment2: page.segment_2,
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
    const urlsNodeId = new Map(); // url id to node Id
    const nodesId = new Map();    // node key to node id
    const nodesValue = [];

    return this.db.urls.each((url) => {
      // Register url in a groupNode
      const [nodeKey, key1, key2] = this._computeGroupNodeKey(url, groupBy1, groupBy2);
      let nodeId = nodesId.get(nodeKey);
      if (!nodeId) {
        nodeId = nodesId.size + 1; // make ids start at 1
        nodesId.set(nodeKey, nodeId);
        nodesValue.push({ id: nodeId, group, key1, key2, count: 1 });
      } else {
        nodesValue[nodeId - 1].count++;
      }
      urlsNodeId.set(url.id, nodeId);
    })
    .then(() => this.db.groupsNodes.bulkAdd(nodesValue))
    .then(() => urlsNodeId);
  }

  _computeGroupLinks(group, groupBy1, groupBy2, followValue, urlsNodeId) {
    const linksId = new Map();
    const linksValue = [];

    let pt = this.db.links;
    if (followValue !== null) {
      pt = pt.where('follow').equals(followValue);
    }

    return pt.each((link) => {
      const fromId = urlsNodeId.get(link.source);
      const toId = urlsNodeId.get(link.destination);
      const linkKey = md5(`${fromId}:${toId}`);

      let linkId = linksId.get(linkKey);
      if (!linkId) {
        linkId = linksId.size + 1; // make ids start at 1
        linksId.set(linkKey, linkId);
        linksValue.push({
          id: linkId,
          group,
          from: fromId,
          to: toId,
          count: 1,
        });
      } else {
        linksValue[linkId - 1].count++;
      }
    })
    .then(() => this.db.groupsLinks.bulkAdd(linksValue));
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
      ready: false,
    })
    .then(() => new Analysis(analysis.id));
  });
}
