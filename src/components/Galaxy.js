import React, { PropTypes } from 'react';

import VisNetwork from './VisNetwork';
import './Galaxy.css';


export default class Galaxy extends React.Component {
  static propTypes = {
    analysis: PropTypes.any,
  };

  constructor(props) {
    super(props);

    this.state = {
      nodes: null,
      links: null,
      groups: null,
    };
  }

  componentDidMount() {
    this.props.analysis.getGroups()
    .then((groups) => {
      this.setState({ groups });
      return groups[0].id;
    })
    .then(groupId => this.props.analysis.getGroup(groupId))
    .then(({ nodes, links }) => this.setState({ nodes, links }));
  }

  renderNetwork() {
    const nodes = this.state.nodes.map(node => ({
      id: node.id,
      value: node.count,
      group: node.id,
    }));
    const edges = this.state.links.map(link => ({
      from: link.from,
      to: link.to,
      value: link.count,
    }));
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
