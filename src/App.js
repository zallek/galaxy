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

  onChooseAnalysis({ id, url }) {
    if (id) {
      // Use existing analysis
      this.setState({
        analysis: new Analysis(id),
        ready: true,
      });
      return;
    }

    // create new analysis
    this.setState({
      loadingStep: 1,
    });

    createAnalysis(url)
    .then((analysis) => {
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
        data={this.state.data}
      />
    );
  }

  render() {
    const { ready, loadingStep } = this.state;
    if (ready) return this.renderGalaxy();
    else if (loadingStep) return this.renderLoading();
    return this.renderForm();
  }
}

export default App;
