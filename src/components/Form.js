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
          <label htmlFor="analysisUrl">Welcome. Select a demo</label>
          <input type="url" required id="analysisUrl" name="analysisUrl" className="form-control" disabled />
        </div>
        <div className="button">
          <button type="submit" className="btn btn-primary" disabled>Start</button>
        </div>
      </form>
      <div className="Form-analyses">
        <label></label>
        {analyses.map(analysis =>
          <div
            key={analysis.id}
            className="Form-analysis"
            onClick={() => onSubmit({ id: analysis.id, refresh: !analysis.ready })}
          >
            {analysis.img && <img role="presentation" alt="" className="Form-analysis-img" src={analysis.img} />}
            <div className="Form-analysis-name">
              <div>{analysis.owner}</div>
              <div>{analysis.projectSlug}</div>
              <div>{analysis.analysisSlug}</div>
            </div>
            <div className="Form-analysis-info">
              <div>{analysis.knownUrls} URLs</div>
              <div>{analysis.links} Links</div>
            </div>
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
