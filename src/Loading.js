import React from 'react';

import './Loading.css';


class Loading extends React.Component {
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
        Fetching your data
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
