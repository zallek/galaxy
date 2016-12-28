import React from 'react';

import Analysis, { getAnalyses, createAnalysis, insertDemos } from './lib/Analysis';
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
    };

    this.onChooseAnalysis = this.onChooseAnalysis.bind(this);
  }

  componentDidMount() {
    insertDemos()
    .then(() => getAnalyses())
    .then((analyses) => { this.setState({ analyses }); })
    .catch((loadingError) => { this.setState({ loadingError }); });
  }

  onChooseAnalysis({ id, refresh, url }) {
    if (id) {
      const analysis = new Analysis(id);
      if (refresh) {
        this.loadAnalysis(analysis);
      } else {
        analysis.init().then(() => this.setState({
          analysis,
        }));
      }
    } else {
      // create new analysis
      this.setState({
        loadingSteps: {},
      });

      createAnalysis(url)
      .then((analysis) => { this.loadAnalysis(analysis); })
      .catch((loadingError) => { this.setState({ loadingError }); });
    }
  }

  loadAnalysis(analysis) {
    this.setState({
      loadingSteps: {
        creation: true,
      },
    });
    analysis.prepare((s) => {
      this.setState({
        loadingSteps: { ...s, creation: true },
      });
    })
    .then(() => { this.setState({ analysis }); })
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
    const { analysis, loadingSteps, loadingError } = this.state;
    if (analysis && !loadingError) return this.renderGalaxy();
    else if (loadingSteps || loadingError) return this.renderLoading();
    return this.renderForm();
  }
}

export default App;
