import React from 'react';

import Form from './Form';
import Loading from './Loading';
import './App.css';


class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      analysisUrl: null,
    };
  }

  renderForm() {
    return (
      <Form onSubmit={({ analysisUrl }) => this.setState({ analysisUrl })} />
    );
  }

  renderLoading() {
    return (
      <Loading analysisUrl={this.state.analysisUrl} />
    );
  }

  render() {
    if (!this.state.analysisUrl) return this.renderForm();
    return this.renderLoading();
  }
}

export default App;
