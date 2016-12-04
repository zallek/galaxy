import React, { PropTypes } from 'react';

import VisNetwork from './VisNetwork';


export default class Galaxy extends React.Component {
  static propTypes = {
    analysis: PropTypes.any,
  };

  componentDidMount() {
    this.props.analysis.getGroup(0)
    .then(data => this.setState(data));
  }

  renderNetwork() {
    const { nodes, edges } = this.state;
    return (
      <VisNetwork
        nodes={nodes}
        edges={edges}
        options={{
          physics: {
            solver: 'forceAtlas2Based',
          },
        }}
      />
    );
  }

  render() {
    if (!this.state.nodes) return null;

    return (
      <div className="Galaxy">
        {this.renderNetwork()}
      </div>
    );
  }
}
