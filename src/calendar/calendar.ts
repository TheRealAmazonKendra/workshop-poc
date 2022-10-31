import path from 'path';
import { aws_lambda_nodejs, custom_resources, aws_lambda, CustomResource } from 'aws-cdk-lib';
import { Role } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface CalendarLocationOptionsBase {
  calendarName: string;
  calendarPath?: string;
};

export interface S3LocationOptions extends CalendarLocationOptionsBase {
  bucketName: string;
  roleArn?: string;
};

export enum CalendarSourceType {
  S3Object = 's3Object',
  PATH = 'path',
};

export abstract class Calendar {
  public static calendarName: string;

  public static path(options: CalendarLocationOptionsBase) {
    return new class extends Calendar {
      public calendarName = options.calendarName;
      public _bind(scope: Construct): Calendar {
        return new CustomResourceCalendar(scope, {
          sourceType: CalendarSourceType.PATH,
          calendarPath: options.calendarPath ? options.calendarPath : __dirname,
          calendarName: options.calendarName,
        });
      }
    };
  }

  public static s3Location(options: S3LocationOptions): Calendar {
    return new class extends Calendar {
      public calendarName = options.calendarName;
      public _bind(scope: Construct): Calendar {
        return new CustomResourceCalendar(scope, {
          sourceType: CalendarSourceType.S3Object,
          calendarPath: options.bucketName,
          calendarName: `${options.calendarPath}/${options.calendarName}`,
          roleArn: options.roleArn,
        });
      }
    };
  }

  public abstract readonly calendarName: string;

  protected constructor() {}

  /**
   *
   * @internal
   */
  public abstract _bind(scope: Construct): any;
}

interface CustomResourceCalendarOptions extends CalendarLocationOptionsBase {
  sourceType: CalendarSourceType;
  calendarPath: string;
  roleArn?: string;
}

class CustomResourceCalendar extends Calendar {
  public readonly sourceType: string;
  public readonly calendarPath: string;
  public readonly roleArn?: string;
  public readonly calendarName: string;

  constructor(scope: Construct, options: CustomResourceCalendarOptions) {
    super();

    this.sourceType = options.sourceType;
    this.calendarPath = options.calendarPath;
    this.roleArn = options.roleArn;
    this.calendarName = options.calendarName;

    const onEvent: aws_lambda.Function = new aws_lambda_nodejs.NodejsFunction(scope, 'OnEventHandler', {
      entry: path.join(__dirname, 'calendar-source.lambda.ts'),
    });

    const provider = new custom_resources.Provider(scope, 'Provider', {
      onEventHandler: onEvent,
      role: this.roleArn ? Role.fromRoleArn(scope, '', this.roleArn) : undefined,
    });

    new CustomResource(scope, 'SSMCalendarCustomResource', {
      serviceToken: provider.serviceToken,
      properties: {
        sourceType: this.sourceType,
        path: this.calendarPath,
      },
    });
  }

  public _bind() {}
}