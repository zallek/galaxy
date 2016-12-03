import BotifySDK from './sdk';


const EXPORTS = {
  ALL_LINKS: 'ALL_LINKS',
  ALL_URL_DETAILS: 'ALL_URL_DETAILS',
};

export const FETCHING_STEPS = {
  ANALYSIS_INFO: 0,
  LINKS: 1,
  SEGMENTS: 2,
};

export const INVALID_REASONS = {
  NOT_EXISTS: 0,
  NO_SEGMENTS: 1,
};

class Data {

  constructor(analysisUrl) {
    this.analysisMeta = this._extractAnalaysisMeta(analysisUrl);
    BotifySDK.setEnv(this.analysisMeta.env);

    this.pagesIndes = {}; // url -> pageIdx
    this.pages = [];      // { data, outlinks: [{ pageIdx, count }] }
  }

  /**
   * @param  {Func} notify Called several times wih step done
   * @return {Promise}
   */
  fetchData(notify) {
    // Analysis Info
    return this._fetchAnalysisInfo()
    .catch((error) => {
      if (error.status === 404) {
        return Promise.resolve(null);
      }
      return Promise.reject(error);
    })
    .then(() => {
      const reason = this._isAnalysisInvalid();
      if (reason) {
        const error = new Error('Analysis is invalid');
        error.reason = reason;
        return Promise.reject(error);
      }
      return null;
    })
    .then(() => notify(FETCHING_STEPS.ANALYSIS_INFO))
    // Links
    .then(() => this._prepareExport(EXPORTS.ALL_LINKS))
    .then(downloadUrl => this._downloadExport(downloadUrl))
    .then(links => this._processLinksCSV(links))
    .then(() => notify(FETCHING_STEPS.LINKS))
    // Segments
    .then(() => this._prepareExport(EXPORTS.ALL_URL_DETAILS))
    .then(downloadUrl => this._downloadExport(downloadUrl))
    .then(allUrls => this._processAllUrlsCSV(allUrls))
    .then(() => notify(FETCHING_STEPS.SEGMENTS))
  }

  _extractAnalaysisMeta(url) {
    const splits = url.split('/');
    const tempEnv = splits[2].split('.')[1];

    return {
      env: tempEnv === 'botify' ? 'production' : tempEnv,
      username: splits[3],
      projectSlug: splits[4],
      analysisSlug: splits[5],
    };
  }

  _fetchAnalysisInfo() {
    return BotifySDK.AnalysisController.getAnalysisSummaryAsync(this.analysisMeta)
    .then((result) => {
      this.analysis = {
        url: result.url,
        crawledUrls: result.urls_done,
        knownUrls: result.urls_in_queue,
        segmentsNames: result.features.segments ? result.features.segments.names : [],
      };
    });
  }

  _isAnalysisInvalid() {
    return !this.analysis ? INVALID_REASONS.NOT_EXISTS
         : !this.analysis.segmentsNames.length ? INVALID_REASONS.NO_SEGMENTS
         : null;
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
      ...this.analysisMeta,
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
      ...this.analysisMeta,
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

  _processLinksCSV(csv) {
    const pagesIndex = {}; // url -> id
    const pages = [];      // id -> { pageIdx, outlinks }

    csv.split('\n').forEach((line, i) => {
      if (i === 0) return;
      const [source, destination, type] = line.split(',');

      if (type !== 'Internal') return;

      // register source
      if (!pagesIndex[source] && pagesIndex[source] !== 0) {
        const newLength = pages.push({
          url: source,
          outlinks: [],
        });
        pagesIndex[source] = newLength - 1;
      }
      const sourceIdx = pagesIndex[source];

      // register destination
      if (!pagesIndex[destination]) {
        const newLength = pages.push({
          url: destination,
          outlinks: [],
        });
        pagesIndex[destination] = newLength - 1;
      }
      const destinationIdx = pagesIndex[destination];

      // register outlink
      const outlink = pages[sourceIdx].outlinks.find(o => o.pageIdx === destinationIdx);
      if (!outlink) {
        pages[sourceIdx].outlinks.push({ pageIdx: destinationIdx, count: 1 });
      } else {
        outlink.count++;
      }
    });

    this.pagesIndex = pagesIndex;
    this.pages = pages;
  }

  _processAllUrlsCSV(csv) {
    const colsIdx = {
      url: 24,
      segments: [20, 21, 22],
    };

    csv.split('\n').forEach((line, i) => {
      if (i === 0) return;

      const splits = line.split(',');
      const pageIdx = this.pagesIndex[colsIdx.url];
      this.pages[pageIdx].segments = {};
      this.analysis.segmentsNames.forEach((name, j) => {
        this.pages[pageIdx].segments[name] = splits[colsIdx.segments[j]];
      });
    });
  }

}

export default Data;
