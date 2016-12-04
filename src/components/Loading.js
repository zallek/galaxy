import React, { PropTypes } from 'react';

import { INVALID_REASONS } from '../lib/Analysis';
import Loader from './Loader';
import './Loading.css';


const LOADING_STEPS = [
  'Fetching Analysis Info',
  'Fetching URLs Links',
  'Fetching URLs Segments',
  'Preparing Visualisation',
];

const Loading = ({ step, error }) => {
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
        {LOADING_STEPS.map((name, i) =>
          <div key={i} className="Loading-state clearfix">
            <span className="Loading-state-name">{name} ...</span>
            <span className="Loading-state-status">{step > i + 1 && 'done'}</span>
          </div>,
        )}
        {errorMessage && <strong className="text-danger">{errorMessage}</strong>}
      </Loader>
    </div>
  );
};
Loading.propTypes = {
  step: PropTypes.number.isRequired,
  error: PropTypes.instanceOf(Error),
};

export default Loading;
