import path from 'path';
import { ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { IStage } from 'aws-cdk-lib/aws-codepipeline';
import { Rule, RuleTargetInput, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { Calendar } from '../calendar/calendar';
// import { Function } from 'aws-cdk-lib/aws-lambda';

export interface ChangeControllerProps {
  calendar: Calendar;
  stage: IStage;
  schedule: Schedule;
  changeControlAlarmProps: ChangeControlAlarmProps;
};

export interface ChangeControlAlarmProps {
  roleArn: string;
  searchTerms: string[];
}

export class ChangeController extends Construct {
  constructor(scope: Construct, id: string, props: ChangeControllerProps) {
    super(scope, id);

    // Function.fromFunctionName(this, )

    const fn = new NodejsFunction(this, `ChangeController${props.stage.pipeline.pipelineName}${props.stage.stageName}`, {
      entry: path.join(__dirname, 'change-controller.handler.ts'),
    });

    // Grant permission for stage transitions
    fn.addToRolePolicy(
      new PolicyStatement({
        resources: [`${props.stage.pipeline.pipelineArn}*`],
        actions: [
          'codepipeline:EnableStageTransition',
          'codepipeline:DisableStageTransition',
          'codepipeline:GetPipelineState',
        ],
        effect: Effect.ALLOW,
      }),
    );

    // Grant permission to retrieve calendars
    fn.addToRolePolicy(
      new PolicyStatement({
        resources: ['*'],
        actions: ['ssm:GetCalendarState'],
        effect: Effect.ALLOW,
      }),
    );

    // Grant permission to assume alarm roles
    fn.addToRolePolicy(
      new PolicyStatement({
        resources: [props.changeControlAlarmProps.roleArn],
        actions: ['sts:AssumeRole'],
        effect: Effect.ALLOW,
      }),
    );

    // Any error in the lambda function will close the time window
    fn.metricErrors().with({ statistic: 'sum' }).createAlarm(this, 'change-controller-alarm', {
      alarmName: `ChangeController-${props.stage.pipeline.pipelineName}${props.stage.stageName}`,
      evaluationPeriods: 1,
      threshold: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.BREACHING,
    });

    // Create a rule to run the lambda on a schedule defined by the user
    new Rule(this, 'Scheduler', {
      ruleName: fn.functionName,
      schedule: props.schedule,
      targets: [
        new LambdaFunction(fn, {
          event: RuleTargetInput.fromObject({
            calendar: props.calendar,
            changeControlAlarmProps: props.changeControlAlarmProps,
            stage: props.stage,
          }),
        }),
      ],
    });
  }
}