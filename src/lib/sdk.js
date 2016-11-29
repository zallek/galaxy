import baseSdk from 'botify-sdk';
import {
  applyMiddleware,
  apiErrorMiddleware,
  jobsMiddleware,
} from 'botify-sdk-middlewares';


/** Configure SDK **/


const envs = {
  production: {
    apiBase: 'https://api.botify.com',
    token: process.env.BOTIFY_PRODUCTION_TOKEN,
  },
  staging: {
    apiBase: 'http://api.staging.botify.com',
    token: process.env.BOTIFY_STAGING_TOKEN,
  },
  sandbox1: {
    apiBase: 'http://api.sandbox1.botify.com',
    token: process.env.BOTIFY_SANDBOX1_TOKEN,
  },
  sandbox2: {
    apiBase: 'http://api.sandbox2.botify.com',
    token: process.env.BOTIFY_SANDBOX2_TOKEN,
  },
  sandbox3: {
    apiBase: 'http://api.sandbox3.botify.com',
    token: process.env.BOTIFY_SANDBOX3_TOKEN,
  },
  sandbox4: {
    apiBase: 'http://api.sandbox4.botify.com',
    token: process.env.BOTIFY_SANDBOX4_TOKEN,
  },
};

const jobOperations = [
  {
    create: { controllerId: 'AnalysisController', operationId: 'createAdvancedExport' },
    poll: { controllerId: 'AnalysisController', operationId: 'getAdvancedExportStatus', jobIdKey: 'advancedExportId' },
  },
];

let sdk = baseSdk; // eslint-disable-line import/no-mutable-exports

sdk = applyMiddleware(
  apiErrorMiddleware,
  jobsMiddleware({ jobs: jobOperations }),
)(sdk);

sdk.setEnv = (env) => {
  console.log('setEnv', env)
  sdk.configuration.authorization = `Token ${envs[env].token}`;
  sdk.configuration.BASEURI = `${envs[env].apiBase}/v1`;
};

export default sdk;
