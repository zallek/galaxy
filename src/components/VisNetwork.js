import React, { PropTypes } from 'react';
import Network from 'vis/lib/network/Network';

import 'vis/dist/vis.css';


 /* // create an array with nodes
  var nodes = new vis.DataSet([
    {id: 1, label: 'Node 1'},
    {id: 2, label: 'Node 2'},
    {id: 3, label: 'Node 3'},
    {id: 4, label: 'Node 4'},
    {id: 5, label: 'Node 5'}
  ]);

  // create an array with edges
  var edges = new vis.DataSet([
    {from: 1, to: 3},
    {from: 1, to: 2},
    {from: 2, to: 4},
    {from: 2, to: 5}
  ]);

  // create a network
  var container = document.getElementById('mynetwork');
  var data = {
    nodes: nodes,
    edges: edges
  };
  var options = {};
  var network = new vis.Network(container, data, options); */


export default class VisNetwork extends React.Component {

  static displayName = 'VisNetwork';

  static propTypes = {
    nodes: PropTypes.array.isRequired,
    edges: PropTypes.array,
    options: PropTypes.object,
    style: PropTypes.object,
  };

  static defaultProps = {
    edges: [],
    options: {},
  };

  componentDidMount() {
    const { nodes, edges, options } = this.props;

    this.timeline = new Network(this.networkNode, {
      nodes,
      edges,
    }, options);
    this.timeline.setOptions(options);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.nodes !== this.props.nodes) {
      console.log('update nodes');
      this.timeline.setNodes(nextProps.nodes);
    }
    if (nextProps.edges !== this.props.edges) {
      console.log('update edges');
      this.timeline.setEdges(nextProps.edges);
    }
  }

  shouldComponentUpdate() {
    return false;
  }

  render() {
    const { style, children } = this.props;

    return (
      <div
        className={'VisNetwork'}
        ref={(ref) => { this.networkNode = ref; }}
        style={style}
      >
        {children}
      </div>
    );
  }

}
