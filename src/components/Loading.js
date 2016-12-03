import React, { PropTypes } from 'react';

import Data, { INVALID_REASONS } from '../lib/data';
import Loader from './Loader';
import './Loading.css';


const LOADING_STEPS = [
  'Analysis Info',
  'URLs Links',
  'URLs Segments',
];

class Loading extends React.Component {
  static propTypes = {
    analysisUrl: PropTypes.string.isRequired,
    onLoaded: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    this.data = new Data(props.analysisUrl);

    this.state = {
      loadingStep: -1,
      error: null,
    };
  }

  componentDidMount() {
    this.fetchData();
  }

  onStep(stepIdx) {
    this.setState({
      loadingStep: stepIdx,
    });
  }

  fetchData() {
    this.data.fetchData(this.onStep.bind(this))
    .catch((error) => {
      if (error.message === 'Analysis is invalid') {
        this.setState({ analysisInvalid: error.reason });
      } else {
        console.error(error);
        this.setState({ error });
      }
    })
    .then(() => {
      this.props.onLoaded(this.data);
    });
  }

  renderAnalysisInvalid() {
    const { analysisInvalid } = this.state;
    if (!analysisInvalid) return null;

    const text = analysisInvalid === INVALID_REASONS.NOT_EXISTS ? 'Sorry your analysis doesn\'t exist or is not finished yet'
               : analysisInvalid === INVALID_REASONS.NO_SEGMENTS ? 'Sorry your analysis needs to use segmentation'
               : 'Sorry your analysis is invalid';
    return <strong className="text-danger">{text}</strong>;
  }

  render() {
    const { loadingStep, error } = this.state;
    return (
      <div className="Loading">
        <Loader>
          <div>Fetching your data</div>
          {LOADING_STEPS.map((name, i) =>
            <div key={i} className="Loading-state clearfix">
              <span className="Loading-state-name">{name} ...</span>
              <span className="Loading-state-status">{loadingStep >= i && 'done'}</span>
            </div>,
          )}
          {this.renderAnalysisInvalid()}
          {error &&
            <div className="text-warning">{error.message}</div>
          }
        </Loader>
      </div>
    );
  }
}

export default Loading;
