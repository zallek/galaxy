import React, { PropTypes } from 'react';

import { INVALID_REASONS } from '../lib/Analysis';
import Loader from './Loader';
import './Loading.css';


const LOADING_STEPS = [
  { key: 'creation', label: 'Fetching Analysis Info' },
  { key: 'pages', label: 'Fetching URLs', progress: true },
  { key: 'links', label: 'Fetching URLs Links', progress: true },
  { key: 'visualisation', label: 'Preparing Visualisation' },
];

const Loading = ({ steps, error }) => {
  let errorMessage = null;
  if (error) {
    if (!error.reason) {
      errorMessage = error.message;
    } else if (error.reason === INVALID_REASONS.NOT_EXISTS) {
      errorMessage = 'Sorry your analysis doesn\'t exist or is not finished yet';
    } else if (error.reason === INVALID_REASONS.NO_SEGMENTS) {
      errorMessage = 'Sorry your analysis needs to use segmentation';
    } else {
      errorMessage = 'Sorry your analysis is invalid';
    }
  }

  return (
    <div className="Loading">
      <Loader>
        {LOADING_STEPS.map(({ key, label, progress }, i) =>
          <div key={i} className="Loading-state clearfix">
            <span className="Loading-state-name">{label} ...</span>
            <span className="Loading-state-status">
              { progress && steps[key] && steps[key] !== 1 ? `${Math.floor(steps[key] * 100)}%`
              : steps[key] ? 'done'
              : ''}
            </span>
          </div>,
        )}
        {errorMessage && <strong className="text-danger">{errorMessage}</strong>}
      </Loader>
    </div>
  );
};
Loading.propTypes = {
  steps: PropTypes.object.isRequired,
  error: PropTypes.instanceOf(Error),
};

export default Loading;
