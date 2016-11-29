import React, { PropTypes } from 'react';
import BotifySDK from './lib/sdk';

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
    console.log(url);
  }

  renderLoader() {
    return (
      <div className="sk-cube-grid">
        <div className="sk-cube sk-cube1" />
        <div className="sk-cube sk-cube2" />
        <div className="sk-cube sk-cube3" />
        <div className="sk-cube sk-cube4" />
        <div className="sk-cube sk-cube5" />
        <div className="sk-cube sk-cube6" />
        <div className="sk-cube sk-cube7" />
        <div className="sk-cube sk-cube8" />
        <div className="sk-cube sk-cube9" />
      </div>
    );
  }

  renderText() {
    return (
      <h2 className="Loading-text">
        <div>Fetching your data</div>
        {this.state.error &&
          <strong className="text-danger">{this.state.error.message}</strong>
        }
      </h2>
    );
  }

  render() {
    return (
      <div className="Loading">
        {this.renderLoader()}
        {this.renderText()}
      </div>
    );
  }
}

export default Loading;
