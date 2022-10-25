import { CloudWatch, STS } from 'aws-sdk';

export interface AlarmDetail {
  state?: string;
  reason: string;
};

export interface AggregateAlarmState {
  alarmDetails: AlarmDetail[];
  state: string;
  summary: string;
};

/**
 * searchTerms: a list of terms to match in the alarm description
 */
export interface GetAlarmStateOptions extends GetAlarmOptions {
  searchTerms: string[];
};

interface GetAlarmOptions {
  roleArn: string;
  pipelineName: string;
  stageName: string;
}

const getCloudwatchAlarms = async(options: GetAlarmOptions): Promise<any> => {
  const sts = new STS();
  const credentials = (await sts.assumeRole({
    RoleArn: options.roleArn,
    RoleSessionName: `change-control-${options.pipelineName}-${options.stageName}`,
  }).promise()).Credentials;

  const cloudwatch = new CloudWatch({
    credentials: {
      accessKeyId: credentials!.AccessKeyId,
      secretAccessKey: credentials!.SecretAccessKey,
      sessionToken: credentials!.SessionToken,
    },
  });

  let nextToken;
  let results: any[] = [];

  do {
    const result: CloudWatch.DescribeAlarmsOutput = await cloudwatch
      .describeAlarms({ AlarmTypes: ['CompositeAlarm', 'MetricAlarm'], NextToken: nextToken })
      .promise();

    results = result.MetricAlarms ? results.concat(result.MetricAlarms) : results;
    results = result.CompositeAlarms ? results.concat(result.CompositeAlarms) : results;

    nextToken = result.NextToken;
  } while (nextToken);
};

/**
 * Returns all alarms starting with the provided prefix in the state of ALARM. In addition,
 * any exceptions caught will be logged and converted into an alarm state of options.defaultState
 * with an associated reason.
 */
export const getAlarms = async (options: GetAlarmStateOptions): Promise<AlarmDetail[]> => {


  const states: AlarmDetail[] = [];
  try {
    const alarms = await getCloudwatchAlarms({
      roleArn: options.roleArn,
      pipelineName: options.pipelineName,
      stageName: options.stageName,
    });
    for await (const alarm of alarms) {
      // If there are no search terms OR if there's a search term and a match, return the alarm
      if (
        options.searchTerms.length === 0 ||
        options.searchTerms.find((searchTerm) => alarm.AlarmDescription?.includes(searchTerm)) !== undefined
      ) {
        states.push({ state: alarm.StateValue, reason: `${alarm.AlarmArn} in ${alarm.StateValue}.` });
      }
    }

    if (states.length === 0) {
      states.push({
        state: 'ALARM',
        reason: `No alarms were found for the provided search terms: ${options.searchTerms.join(', ')}.`,
      });
    }
  } catch (e) {
    const message = 'Unable to retrieve alarms.';
    console.error(message, e);
    states.push({ reason: message, state: 'ALARM' });
  }

  return states;
};

/**
 * Calculate and return an aggregate alarm state across alarms returned from all
 * CloudWatch clients provided. If any client errors are thrown, the returned state
 * will be ALARM.
 *
 */
export const getAggregateAlarmState = async (options: GetAlarmStateOptions): Promise<AggregateAlarmState> => {
  const alarmDetails: AlarmDetail[] = await getAlarms(options);

  return {
    alarmDetails,
    state: alarmDetails.find((a) => a.state === 'ALARM') !== undefined ? 'ALARM' : 'OK',
    summary: `${alarmDetails
      .filter((a) => a.state === 'ALARM')
      .map((a) => a.reason)
      .join(' ')}`,
  };
};