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
      loadingSteps: null,
      loadingError: null,
      ready: false,
    };

    this.onChooseAnalysis = this.onChooseAnalysis.bind(this);
  }

  componentDidMount() {
    getAnalyses()
    .then((analyses) => { this.setState({ analyses }); })
    .catch((loadingError) => { this.setState({ loadingError }); });
  }

  onChooseAnalysis({ id, refresh, url }) {
    if (id) {
      const analysis = new Analysis(id);
      if (refresh) {
        this.prepareAnalysis(analysis);
      } else {
        this.setState({
          analysis,
          ready: true,
        });
      }
    } else {
      // create new analysis
      this.setState({
        loadingSteps: {},
      });

      createAnalysis(url)
      .then((analysis) => { this.prepareAnalysis(analysis); })
      .catch((loadingError) => { this.setState({ loadingError }); });
    }
  }

  prepareAnalysis(analysis) {
    Promise.resolve()
    .then(() => {
      this.setState({
        analysis,
        loadingSteps: {
          creation: true,
        },
      });
      return analysis.prepare((s) => { this.setState({ loadingSteps: { ...s, creation: true } }); });
    })
    .then(() => { this.setState({ ready: true }); })
    .catch((loadingError) => { this.setState({ loadingError }); });
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
    const { loadingSteps, loadingError } = this.state;
    return (
      <Loading
        steps={loadingSteps}
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
    const { ready, loadingSteps, loadingError } = this.state;
    if (ready && !loadingError) return this.renderGalaxy();
    else if (loadingSteps || loadingError) return this.renderLoading();
    return this.renderForm();
  }
}

export default App;
