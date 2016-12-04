import React from 'react';

import Analysis, { getAnalyses, createAnalysis } from './lib/Analysis';
import Form from './components/Form';
import Loading from './components/Loading';
import Galaxy from './components/Galaxy';
import './App.css';


class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      analyses: [],
      analysis: null,
      loadingStep: null,
      loadingError: null,
      ready: false,
    };

    this.onChooseAnalysis = this.onChooseAnalysis.bind(this);
  }

  componentDidMount() {
    getAnalyses().then(analyses => this.setState({ analyses }));
  }

  onChooseAnalysis({ id, refresh, url }) {
    if (id) {
      const analysis = new Analysis(id);
      if (refresh) {
        this.prepareAnalaysis(analysis);
      } else {
        this.setState({
          analysis,
          ready: true,
        });
      }
    } else {
      // create new analysis
      this.setState({
        loadingStep: 1,
      });

      createAnalysis(url)
      .then(analysis => this.prepareAnalaysis(analysis))
      .catch(loadingError => this.setState({ loadingError }));
    }
  }

  prepareAnalaysis(analysis) {
    return Promise.resolve()
    .then(() => {
      this.setState({
        analysis,
        loadingStep: 2,
      });
      return analysis.prepare(s => this.setState({ loadingStep: s + 3 }));
    })
    .then(() => this.setState({
      ready: true,
      loadingStep: null,
    }))
    .catch(loadingError => this.setState({ loadingError }));
  }

  renderForm() {
    return (
      <Form
        analyses={this.state.analyses}
        onSubmit={this.onChooseAnalysis}
      />
    );
  }

  renderLoading() {
    const { loadingStep, loadingError } = this.state;
    return (
      <Loading
        step={loadingStep}
        error={loadingError}
      />
    );
  }

  renderGalaxy() {
    return (
      <Galaxy
        analysis={this.state.analysis}
      />
    );
  }

  render() {
    const { ready, loadingStep, loadingError } = this.state;
    if (ready && !loadingError) return this.renderGalaxy();
    else if (loadingStep || loadingError) return this.renderLoading();
    return this.renderForm();
  }
}

export default App;
