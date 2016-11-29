import React, { PropTypes } from 'react';

import './Form.css';


const Form = ({ onSubmit }) => {
  return (
    <form
      className="Form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(e.target.analysisUrl.value);
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
  );
};
Form.propTypes = {
  onSubmit: PropTypes.func.isRequired,
};

export default Form;
