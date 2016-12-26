import React, { PropTypes } from 'react';

import VisNetwork from './VisNetwork';
import './Galaxy.css';
import { GROUP_STATUS } from '../lib/Analysis';


class GroupBy extends React.Component {

  static propTypes = {
    choices: PropTypes.array.isRequired,
    value: PropTypes.array.isRequired,
    groups: PropTypes.object.isRequired,
    onChange: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);

    this.state = {
      tempValue: props.value.map(v => v || 'null'),
    };

    this.updateTempValue = this.updateTempValue.bind(this);
  }

  componentWillReceiveProps(props) {
    this.setState({ tempValue: props.value.map(v => v || 'null') });
  }

  updateTempValue(v, side) {
    const { tempValue } = this.state;
    const newPartValue = v === 'null' ? null : v;

    if (side === 'left') {
      this.setState({ tempValue: [newPartValue, tempValue[1]] });
    } else {
      this.setState({ tempValue: [tempValue[0], newPartValue] });
    }
  }

  render() {
    const { choices, groups, onChange } = this.props;
    const { tempValue } = this.state;
    const currentGroup = groups[tempValue.join(':')];

    return (
      <div className="Galaxy-groupby">
        <span>Group by</span>
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
        {currentGroup && currentGroup.status === GROUP_STATUS.SUCCESS &&
          <button className="form-control btn-success" onClick={() => onChange(tempValue)}>Change</button>
        }
        {(currentGroup && currentGroup.status === GROUP_STATUS.COMPUTING) ?
          <span className="label label-warning">Computing</span> :
          <button className="form-control btn-primary" onClick={() => onChange(tempValue, true)}>Recompute</button>
        }
        {currentGroup && currentGroup.status === GROUP_STATUS.FAILED &&
          <span className="label label-danger">Error {currentGroup.error && currentGroup.error.message}</span>
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
      currentGroup: ['segment1', null],
      groups: {},
      nodes: null,
      links: null,
    };
  }

  componentDidMount() {
    this.props.analysis.getGroups()
    .then((initGroups) => {
      const groups = {};
      initGroups.forEach((group) => {
        if (!group.status) {
          groups[`${group.groupBy1}:${group.groupBy2}`] = {
            id: group.id,
            status: GROUP_STATUS.SUCCESS,
          };
        }
      });
      this.setState({ groups });
      if (initGroups.length) {
        this.updateViz(initGroups[0].id);
      }
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
    const { groups, currentGroup } = this.state;

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
        groups={groups}
        value={currentGroup}
        onChange={(newGroup, recompute) => {
          const groupKey = [`${newGroup[0]}:${newGroup[1]}`];
          this.setState({
            currentGroup: newGroup,
          });

          const group = groups[groupKey];
          if (!recompute && group) {
            if (group.error) return;
            this.updateViz(group.id);
          } else {
            this.setState({
              groups: { ...groups, [groupKey]: { status: GROUP_STATUS.COMPUTING } },
            });
            analysis.computeGroup(...newGroup)
            .then((id) => {
              this.setState({
                groups: { ...groups, [groupKey]: { id, status: GROUP_STATUS.SUCCESS } },
              });
              this.updateViz(id);
            })
            .catch((error) => {
              this.setState({
                groups: { ...groups, [groupKey]: { status: GROUP_STATUS.FAILED, error } },
              });
            });
          }
        }}
      />
    );
  }

  renderNetwork() {
    if (!this.state.nodes) return null;
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
              opacity: 0.15,
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
