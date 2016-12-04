import Dexie from 'dexie';
import bMd5 from 'blueimp-md5';

import BotifySDK from './sdk';


const EXPORTS = {
  ALL_LINKS: 'ALL_LINKS',
  ALL_URL_DETAILS: 'ALL_URL_DETAILS',
};

export const FETCHING_STEPS = {
  ANALYSIS_INFO: 0,
  LINKS: 1,
  SEGMENTS: 2,
  VISUALISATION: 3,
};

export const INVALID_REASONS = {
  NOT_EXISTS: 0,
  NO_SEGMENTS: 1,
};

const hash = string => Number.parseInt(bMd5(string), 16);

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
      urls: 'id', // url,segment1,segment2,segment3
      links: '++id, source, follow', // destination
      groups: '++id, [groupBy1+groupBy2]',
      groupsNodes: '++id, group, [group+key1+key2]', // count
      groupsLinks: '++id, group', // from,to,count',
    });
  }

  /**
   * @param  {Func} notify Called several times wih step done
   * @return {Promise}
   */
  prepare(notify) {
    return Promise.resolve()
    .then(() => this._initSDK())
    // Links
    .then(() => this._prepareExport(EXPORTS.ALL_LINKS))
    .then(downloadUrl => this._downloadExport(downloadUrl))
    .then(links => this._storeLinksFromExtract(links))
    .then(() => notify(FETCHING_STEPS.LINKS))
    // Segments
    .then(() => this._prepareExport(EXPORTS.ALL_URL_DETAILS))
    .then(downloadUrl => this._downloadExport(downloadUrl))
    .then(allUrls => this._storeSegmentsFromExtract(allUrls))
    .then(() => notify(FETCHING_STEPS.SEGMENTS))
    // Prepare first visualisation
    .then(() => this._prepareFirstGroup)
    .then(() => notify(FETCHING_STEPS.VISUALISATION))
    // Set ready
    .then(() => this._setReady);
  }

  computeGroup(groupBy1, groupBy2, followType) {
    return Promise.resolve()
    .then(() => this.db.groups.add({ groupBy1, groupBy2 }))
    .then((group) => {
      return this.db.urls.each((url) => {
        const key = { group: group.id, key1: url[groupBy1], key2: groupBy2 ? url[groupBy2] : null };
        let id = null;

        return Promise.resolve()
        // Add url to groupsNodes
        .then(() => this.db.groupsNodes.where(key).first())
        .then((node) => {
          if (node) {
            id = node.id;
            return this.db.groupsNodes.update({ count: group.count + 1 }, id);
          }
          return this.db.groupsNodes.add({ ...key, count: 1 });
        })
        .then((newId) => {
          if (!id) id = newId;
          const linksKey = { source: url.id };
          if (followType) {
            linksKey.follow = followType === 'Follow';
          }

          return this.db.links.where(linksKey)
          .then((links) => {
            const toCounts = {};
            links.forEach((link) => {
              if (!toCounts[link]) toCounts[link] = 0;
              toCounts[link]++;
            });

            const groupLinks = Object.key(toCounts).map(to => ({
              from: id,
              to,
              count: toCounts[to],
            }));
            return this.db.groupsLinks.bulkAdd(groupLinks);
          });
        });
      });
    });
  }

  getGroup(id) {
    return Promise.all([
      this.db.groupsNodes.where({ group: id }).toArray(),
      this.db.groupsLinks.where({ group: id }).toArray(),
    ])
    .then(([nodes, links]) => ({ nodes, links }));
  }

  // PRIVATE

  _initSDK() {
    return analysesDB.analyses.get(this.id)
    .then((analysis) => {
      this.info = analysis;
      BotifySDK.setEnv(analysis.env);
    });
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

  _addUrlIfNotExist(url) {
    const id = hash(url);
    return this.db.urls.get(id)
    .then((item) => {
      if (!item) {
        return this.db.urls.add({ id, url });
      }
      return null;
    })
    .then(() => id);
  }

  _storeLinksFromExtract(csv) {
    this.info.links = csv.length - 1;
    return Promise.all([
      csv.split('\n').map((line, i) => {
        if (i === 0) return null;

        const [source, destination, type, follow] = line.split(',');
        if (type !== 'Internal') return null;

        return Promise.resolve()
        .then(() => Promise.all([
          this._addUrlIfNotExist(source),
          this._addUrlIfNotExist(destination),
        ]))
        .then(([sourceId, destinationId]) => this.db.links.add({
          source: sourceId,
          destination: destinationId,
          follow: follow === 'Follow',
        }));
      }),
    ]);
  }

  _storeSegmentsFromExtract(csv) {
    const COLS_IDX = {
      url: 24,
      segment1: 20,
      segment2: 21,
      segment3: 22,
    };

    return Promise.all([
      csv.split('\n').forEach((line, i) => {
        if (i === 0) return null;

        const splits = line.split(',');
        return Promise.resolve()
        .then(() => this._addUrlIfNotExist(splits[COLS_IDX.url]))
        .then(id => this.db.urls.update({
          segment1: splits[COLS_IDX.segment1],
          segment2: splits[COLS_IDX.segment2],
          segment3: splits[COLS_IDX.segment3],
        }, id));
      }),
    ]);
  }

  _setReady() {
    return analysesDB.analyses.update(this.id, {
      links: this.info.links,
      ready: true,
    });
  }

  _prepareFirstGroup() {
    return this._computeGroup('segment1');
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
      knownUrls: analysis.urls_in_queue,
      links: null,
      segmentsName: analysis.features.segments.names,
      ready: false,
    })
    .then(() => new Analysis(analysis.id));
  });
}
