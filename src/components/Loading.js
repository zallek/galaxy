import React, { PropTypes } from 'react';
import BotifySDK from '../lib/sdk';

import Loader from './Loader';

import './Loading.css';


function extractUrl(url) {
  const splits = url.split('/');
  const tempEnv = splits[2].split('.')[1];

  return {
    env: tempEnv === 'botify' ? 'production' : tempEnv,
    username: splits[3],
    projectSlug: splits[4],
    analysisSlug: splits[5],
  };
}

function processCSV(csv) {
  const lines = csv.split('\n');
  const pagesIndex = {}; // url -> id
  const pages = [];      // id -> { pageIdx, outlinks }

  lines.forEach((line, i) => {
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

  return {
    pages,
    pagesIndex,
  };
}

class Loading extends React.Component {
  static propTypes = {
    analysisUrl: PropTypes.string.isRequired,
    onLoaded: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);

    this.state = {
      error: null,
    };
  }

  componentDidMount() {
    this.fetchLinks();
  }

  fetchLinks() {
    const { analysisUrl } = this.props;

    this.analysisMeta = extractUrl(analysisUrl);
    BotifySDK.setEnv(this.analysisMeta.env);

    this.checkIfExportAlreadyExist((exportUrl) => {
      if (!exportUrl) {
        this.exportLinks(newExportUrl => this.downloadLinks(newExportUrl));
      } else {
        this.downloadLinks(exportUrl);
      }
    });
  }

  checkIfExportAlreadyExist(cb) {
    BotifySDK.AnalysisController.getAdvancedExports({
      ...this.analysisMeta,
      size: 30,
    }, (error, response) => {
      if (error) {
        this.setState({ error });
      } else {
        const job = response.results.find(j => j.advanced_export_type === 'ALL_LINKS');
        cb(job ? job.results.download_url : null);
      }
    });
  }

  exportLinks(cb) {
    BotifySDK.AnalysisController.createAdvancedExport({
      ...this.analysisMeta,
      advancedExportQuery: {
        advanced_export_type: 'ALL_LINKS',
        query: {},
      },
    }, (error, job) => {
      if (error) {
        this.setState({ error });
      } else {
        cb(job.results.download_url);
      }
    });
  }

  downloadLinks(url) {
    const oReq = new XMLHttpRequest();

    oReq.open('GET', url, true);
    oReq.onload = () => {
      this.props.onLoaded(processCSV(oReq.response));
    };
    oReq.send();
  }

  render() {
    return (
      <div className="Loading">
        <Loader>
          <div>Fetching your data</div>
          {this.state.error &&
            <strong className="text-danger">{this.state.error.message}</strong>
          }
        </Loader>
      </div>
    );
  }
}

export default Loading;
