import React from 'react';

import Form from './components/Form';
import Loading from './components/Loading';
import Galaxy from './components/Galaxy';
import './App.css';


class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      analysisUrl: null,
      data: null,
    };
  }

  renderForm() {
    return (
      <Form
        onSubmit={analysisUrl => this.setState({ analysisUrl })}
      />
    );
  }

  renderLoading() {
    return (
      <Loading
        analysisUrl={this.state.analysisUrl}
        onLoaded={data => this.setState({ data })}
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
    if (!this.state.analysisUrl) return this.renderForm();
    else if (!this.state.data) return this.renderLoading();
    return this.renderGalaxy();
  }
}

export default App;
