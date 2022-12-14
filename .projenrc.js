const path = require('path');
const { awscdk, LogLevel } = require('projen');
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.49.0',
  defaultReleaseBranch: 'main',
  name: 'pipeline',
  deps: [
    'aws-sdk',
    'projen',
  ],
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  devDeps: [
    '@types/aws-lambda',
  ],
  // packageName: undefined,  /* The "name" in package.json. */
});

project.synth();