import React, { PropTypes } from 'react';

import Loader from './Loader';
import VisNetwork from './VisNetwork';


const Galaxy = ({ data }) => {
  const { pages } = data;

  const edges = [];
  const nodes = pages.map((page, i) => {
    edges.push(...page.outlinks.map(outlink => ({
      from: i,
      to: outlink.pageIdx,
      width: outlink.count,
    })));
    return {
      id: i,
      // fixed: i === 4,
    };
  });
  console.log('Nb nodes', nodes.length);
  console.log('nodes', nodes);
  console.log('Nb edges', edges.length);
  console.log('edges', edges);

  return (
    <VisNetwork
      nodes={nodes}
      edges={edges}
      options={{
        /* edges: {
          physics: false,
          hidden: true,
        },
        physics: {
          enabled: false,
        },*/
        physics: {
          solver: 'forceAtlas2Based',
        },
      }}
    >
      <Loader>
        Loading Visualisation
      </Loader>
    </VisNetwork>
  );
};
Galaxy.propTypes = {
  data: PropTypes.shape({
    pages: PropTypes.array,
    pagesIndex: PropTypes.object,
  }),
};

export default Galaxy;
