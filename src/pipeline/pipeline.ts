import { BuildSpec, ComputeType, LinuxBuildImage, PipelineProject } from 'aws-cdk-lib/aws-codebuild';
import { IRepository } from 'aws-cdk-lib/aws-codecommit';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { CodeBuildAction, CodeCommitSourceAction, CodeCommitTrigger } from 'aws-cdk-lib/aws-codepipeline-actions';
import { Schedule } from 'aws-cdk-lib/aws-events';
import { IRole } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { Calendar } from '../calendar/calendar';
import { ChangeControlAlarmProps, ChangeController } from '../change-controller/change-controller';

export interface PipelineWithChangeControlProps {
  changeControlCalendar: Calendar;
  pipelineName: string;
  pipelineRole?: IRole;
  sourceRepository: IRepository;
  sourceEventRole?: IRole;
  changeControlCheckSchedule: Schedule;
  changecontrolAlarmProps: ChangeControlAlarmProps;
}

export class PipelineWithChangeControl extends Construct {
  constructor(scope: Construct, id: string, props: PipelineWithChangeControlProps) {
    super(scope, id);

    const sourceOutput = new Artifact();
    const buildOutput = new Artifact('BuildOutput');


    const pipeline = new Pipeline(this, 'Pipeline', {
      pipelineName: props.pipelineName,
      role: props.pipelineRole,
      stages: [
        {
          stageName: 'Source',
          actions: [
            new CodeCommitSourceAction({
              actionName: 'CodeCommitSource',
              branch: 'main',
              trigger: CodeCommitTrigger.EVENTS,
              repository: props.sourceRepository,
              output: sourceOutput,
              eventRole: props.sourceEventRole,
            }),
          ],
        },
      ],
    });

    // Build stage
    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new CodeBuildAction({
          actionName: 'BuildAction',
          input: sourceOutput,
          outputs: [buildOutput],
          project: new PipelineProject(this, 'BuildStageProject', {
            buildSpec: BuildSpec.fromObject({
              version: '0.2',
              phases: {
                build: {
                  commands: ['echo Build started on `date`', 'npm run build'],
                },
                post_build: {
                  commands: ['echo Build completed on `date`'],
                },
              },
              artifacts: {
                files: ['build/**/*', 'node_modules/**/*', 'src/*'],
              },
            }),
            environment: {
              buildImage: LinuxBuildImage.AMAZON_LINUX_2_4,
              privileged: true,
              computeType: ComputeType.SMALL,
            },
          }),
        }),
      ],
    });

    pipeline.addStage({
      stageName: 'Deploy',
      actions: [
        new CodeBuildAction({
          actionName: 'DeployAction',
          input: buildOutput,
          project: new PipelineProject(this, 'DeployStageProject', {
            buildSpec: BuildSpec.fromObject({
              version: '0.2',
              phases: {
                install: {
                  'runtime-versions': {
                    nodejs: 16,
                  },
                  // eslint-disable-next-line quote-props
                  commands: ['npm install -g aws-cdk'],
                },
                build: {
                  commands: ['echo Deploy started on `date`', 'cdk deploy'],
                },
                post_build: {
                  commands: ['echo Deploy completed on `date`'],
                },
              },
            }),
            environment: {
              buildImage: LinuxBuildImage.AMAZON_LINUX_2_4,
              privileged: true,
              computeType: ComputeType.SMALL,
            },
          }),
        }),
      ],
    });

    props.changeControlCalendar._bind(this);

    pipeline.stages.forEach((stage) => {
      new ChangeController(this, `change-controller-${stage.stageName}`, {
        calendar: props.changeControlCalendar,
        stage,
        schedule: props.changeControlCheckSchedule,
        changeControlAlarmProps: props.changecontrolAlarmProps,
      });
    });
  }
};