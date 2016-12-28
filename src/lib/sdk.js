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
};

/** End configure */


let sdk = baseSdk; // eslint-disable-line import/no-mutable-exports

sdk = applyMiddleware(
  apiErrorMiddleware,
  jobsMiddleware(),
)(sdk);

sdk.setEnv = (env) => {
  sdk.configuration.authorization = `Token ${envs[env].token}`;
  sdk.configuration.BASEURI = `${envs[env].apiBase}/v1`;
};

/**
 *  Promisification Fn
 */
function promisifyController(controller) {
  Object.keys(controller).forEach((operation) => {
    controller[operation + 'Async'] = (params, opts) => new Promise((resolve, reject) => { // eslint-disable-line
      controller[operation](params, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      }, opts);
    });
  });
}

promisifyController(sdk.AnalysisController);

export default sdk;
