import { Construct } from 'constructs';

export interface SSMChangeControllerProps {
  pathToCalendar: string;
}

export class SSMChangeController extends Construct {
  constructor(scope: Construct, id: string, props: SSMChangeControllerProps) {
    super(scope, id);
  }
}