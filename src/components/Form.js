import React, { PropTypes } from 'react';

import './Form.css';


const Form = ({ analyses, onSubmit }) => {
  return (
    <div className="Form">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ url: e.target.analysisUrl.value });
        }}
      >
        <div className="form-group">
          <label htmlFor="analysisUrl">Enter your Botify Analysis URL</label>
          <input type="url" required id="analysisUrl" name="analysisUrl" className="form-control" />
        </div>
        <div className="button">
          <button type="submit" className="btn btn-primary">Start</button>
        </div>
      </form>
      <div className="row">
        {analyses.map(analysis =>
          <div className="Analysis .col-md-3" onClick={() => onSubmit({ id: analysis.id })}>
            <span>{analysis.owner}</span>
            <span>{analysis.projectSlug}</span>
            <span>{analysis.analysisSlug}</span>
            <span>{analysis.knownUrls} URLs</span>
            <span>{analysis.links} Links</span>
          </div>,
        )}
      </div>
    </div>
  );
};
Form.propTypes = {
  analyses: PropTypes.array.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

export default Form;
