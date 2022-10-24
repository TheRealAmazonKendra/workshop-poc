import { } from 'aws-cdk-lib';
enum CalendarSource {
  S3 = 's3',
  PATH = 'path',
  ARN = 'arn',
};

export interface s3LocationProps {
  calendarName: string;
  bucketName: string;
  path?: string;
  role?: string;
};

export interface arnProps {
  arn: string;
  role?: string;
}

export abstract class Calendar {
  public static path(filePath: string) {

  }

  public static arn(arn: string) {

  }

  public static s3Location() {

  }
}

