import React, { PropTypes } from 'react';

import VisNetwork from './VisNetwork';


const Galaxy = ({ data }) => {
  const { pages } = data;

  const edges = [];
  const nodes = pages.map((page, i) => {
    edges.push(page.outlinks.map(outlink => ({
      from: i,
      to: outlink.pageIdx,
    })));
    return {
      id: i,
      label: page.url,
    };
  });
  console.log('Nb nodes', nodes.length);
  console.log('Nb edges', edges.length);
  debugger;

  return (
    <VisNetwork
      nodes={nodes}
      edges={edges}
    />
  );
};
Galaxy.propTypes = {
  data: PropTypes.shape({
    pages: PropTypes.array,
    pagesIndex: PropTypes.object,
  }),
};

export default Galaxy;
