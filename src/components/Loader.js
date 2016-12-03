import React from 'react';

import './Loader.css';


const Loader = ({ children }) => {
  return (
    <div className="Loader">
      <div className="sk-cube-grid">
        <div className="sk-cube sk-cube1" />
        <div className="sk-cube sk-cube2" />
        <div className="sk-cube sk-cube3" />
        <div className="sk-cube sk-cube4" />
        <div className="sk-cube sk-cube5" />
        <div className="sk-cube sk-cube6" />
        <div className="sk-cube sk-cube7" />
        <div className="sk-cube sk-cube8" />
        <div className="sk-cube sk-cube9" />
      </div>
      <h2 className="Loader-text">
        {children}
      </h2>
    </div>
  );
};

export default Loader;
