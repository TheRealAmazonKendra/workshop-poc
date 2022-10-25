import { App, Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Repository } from 'aws-cdk-lib/aws-codecommit';
import { Schedule } from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
import { Calendar } from './calendar/calendar';
import { PipelineWithChangeControl } from './pipeline/pipeline';

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const sourceRepository = new Repository(this, 'Repository', {
      repositoryName: 'CodeCommitSomethingSomething',
    });

    new PipelineWithChangeControl(this, 'PipelineWithChangeControl', {
      changeControlCalendar: Calendar.s3Location({
        bucketName: 'someBucket',
        calendarName: 'PretendCalendar',
      }),
      pipelineName: 'PipelineWithChangeControl',
      sourceRepository,
      changeControlCheckSchedule: Schedule.rate(Duration.minutes(1)),
      changecontrolAlarmProps: {
        roleArn: 'somerole',
        searchTerms: ['this-pipeline', 'something-else'],
      },
    });
  }
};

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new MyStack(app, 'pipeline-dev', { env: devEnv });
// new MyStack(app, 'pipeline-prod', { env: prodEnv });

app.synth();