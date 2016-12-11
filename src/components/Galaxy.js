import React, { PropTypes } from 'react';

import VisNetwork from './VisNetwork';
import './Galaxy.css';


class GroupBy extends React.Component {

  static propTypes = {
    choices: PropTypes.array.isRequired,
    value: PropTypes.array.isRequired,
    computedGroups: PropTypes.object.isRequired,
    onChange: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);

    this.state = {
      tempValue: props.value,
    };

    this.updateTempValue = this.updateTempValue.bind(this);
  }

  componentWillReceiveProps(props) {
    this.setState({ tempValue: props.value });
  }

  updateTempValue(v, side) {
    const { tempValue } = this.state;
    if (side === 'left') {
      this.setState({ tempValue: [v, tempValue[1]] });
    } else {
      this.setState({ tempValue: [tempValue[0], v] });
    }
  }

  render() {
    const { choices, value, computedGroups, onChange } = this.props;
    const { tempValue } = this.state;
    const valueChanged = tempValue[0] !== value[0] || tempValue[1] !== value[1];

    return (
      <div className="Galaxy-groupby">
        <span>GroupBy</span>
        <select className="form-control" value={tempValue[0]} onChange={e => this.updateTempValue(e.target.value, 'left')} >
          {choices.map(choice =>
            <option key={choice.value} value={choice.value}>{choice.label}</option>,
          )}
        </select>
        <select className="form-control" value={tempValue[1]} onChange={e => this.updateTempValue(e.target.value, 'right')}>
          <option value="null">None</option>,
          {choices.map(choice => choice.value !== tempValue[0] &&
            <option key={choice.value} value={choice.value}>{choice.label}</option>,
          )}
        </select>
        {valueChanged &&
        <button className="form-control btn-primary" onClick={() => onChange(tempValue)}>
          {computedGroups[tempValue.join(':')] ? 'Change' : 'Compute'}
        </button>
        }
      </div>
    );
  }
}

export default class Galaxy extends React.Component {
  static propTypes = {
    analysis: PropTypes.any,
  };

  constructor(props) {
    super(props);

    this.state = {
      currentGroup: ['segment1', 'null'],
      computedGroups: {},
      nodes: null,
      links: null,
    };
  }

  componentDidMount() {
    this.props.analysis.getGroups()
    .then((groups) => {
      const computedGroups = {};
      groups.forEach((group) => {
        computedGroups[`${group.key1}:${group.key2}`] = group.id;
      });
      this.setState({ computedGroups });
      this.updateViz(groups[0].id);
    });
  }

  updateViz(groupId) {
    this.props.analysis.getGroup(groupId)
    .then(({ nodes, links }) => {
      this.setState({
        nodes: nodes.map(node => ({
          id: node.id,
          value: node.count,
          label: node.key1 + (node.key2 ? ` & ${node.key2}` : ''),
          group: node.id,
        })),
        links: links.map(link => ({
          from: link.from,
          to: link.to,
          value: link.count,
          physics: link.count > 1000,
        })),
      });
    });
  }

  renderGroupBy() {
    const { analysis } = this.props;
    const { computedGroups, currentGroup } = this.state;

    const choices = []
    .concat(analysis.info.segmentsName.map((item, i) => ({
      label: `Segment: ${item}`,
      value: `segment${i + 1}`,
    })))
    .concat(analysis.info.extractsName.map((item, i) => ({
      label: `Extract: ${item}`,
      value: `extract${i + 1}`,
    })))
    .concat([
      { label: 'Compliant', value: 'compliant' },
      { label: 'HTTP Code', value: 'httpCode' },
    ]);

    return (
      <GroupBy
        choices={choices}
        computedGroups={computedGroups}
        value={currentGroup}
        onChange={(newGroup) => {
          this.setState({ currentGroup: newGroup });
          const group = computedGroups[newGroup.join(':')];
          if (group) {
            this.updateViz(group);
          } else {
            analysis.computeGroup(...newGroup)
            .then((id) => {
              this.setState({
                ...computedGroups,
                [newGroup.join(':')]: id,
              });
              this.updateViz(id);
            });
          }
        }}
      />
    );
  }

  renderNetwork() {
    if (!this.state.nodes) return null;
    console.log('render', this.state.nodes.length, this.state.links.length);
    return (
      <VisNetwork
        nodes={this.state.nodes}
        edges={this.state.links || []}
        options={{
          physics: {
            solver: 'forceAtlas2Based',
            stabilization: false,
          },
          nodes: {
            shape: 'dot',
            font: {
              color: '#fff',
            },
          },
          edges: {
            arrows: 'to',
            color: {
              opacity: 0.1,
            },
          },
        }}
      />
    );
  }

  renderSidePanel() {
    return (
      <div className="Galaxy-sidepanel" />
    );
  }

  render() {
    return (
      <div className="Galaxy">
        {this.renderGroupBy()}
        {this.renderNetwork()}
        {this.renderSidePanel()}
      </div>
    );
  }
}
