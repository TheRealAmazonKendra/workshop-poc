import { CloudWatch } from 'aws-sdk';
import { DescribeAlarmsOutput } from 'aws-sdk/clients/cloudwatch';

const enum AlarmState {
  OK = 'OK',
  ALARM = 'ALARM',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
}

export interface AlarmDetail {
  alarmArn?: string;
  state: string;
  reason: string;
  alarmDescription?: string;
};

export interface AggregateAlarmState {
  alarmDetails: AlarmDetail[];
  state: AlarmState;
  summary: string;
};

/**
 * searchTerms: a list of terms to match in the alarm description
 */
export interface GetAlarmStateOptions {
  searchTerms: string[];
};

const hasAlarmMatching = (alarms: AlarmDetail[], searchTerms: string[]): AlarmDetail[] => {
  return alarms.flatMap((alarm) => searchTerms.map((searchTerm) => {
    return alarm.alarmDescription?.includes(searchTerm) ? alarm : undefined;
  }).filter((sameAlarm) => sameAlarm)).filter((sameAlarm, index) => alarms.indexOf(sameAlarm!) === index) as AlarmDetail[];
};

const getCloudwatchAlarms = async(): Promise<AlarmDetail[]> => {
  const cloudwatch = new CloudWatch();

  let nextToken;
  let results: AlarmDetail[] = [];

  do {
    const result: DescribeAlarmsOutput = await cloudwatch
      .describeAlarms({ AlarmTypes: ['CompositeAlarm', 'MetricAlarm'], NextToken: nextToken })
      .promise();

    results = result.CompositeAlarms ? results.concat(result.CompositeAlarms?.map(alarm => {
      return {
        alarmArn: alarm.AlarmArn,
        state: alarm.StateValue!,
        reason: alarm.StateReason!,
        alarmDescription: alarm.AlarmDescription,
      };
    })) : results;
    results = result.MetricAlarms ? results.concat(result.MetricAlarms?.map(alarm => {
      return {
        alarmArn: alarm.AlarmArn,
        state: alarm.StateValue!,
        reason: alarm.StateReason!,
        alarmDescription: alarm.AlarmDescription,
      };
    })) : results;

    nextToken = result.NextToken;
  } while (nextToken);
  return results;
};

/**
 * Returns all alarms starting with the provided prefix in the state of ALARM. In addition,
 * any exceptions caught will be logged and converted into an alarm state of options.defaultState
 * with an associated reason.
 */
export const getAlarms = async (searchTerms: string[]): Promise<AlarmDetail[]> => {
  const states: AlarmDetail[] = [];
  try {
    const alarmsForAccountAndRegion = await getCloudwatchAlarms();
    const alarms = hasAlarmMatching(alarmsForAccountAndRegion, searchTerms).map((alarm) => {
      alarm.reason = `${alarm.alarmArn} in ${alarm.state} due to ${alarm.reason}`;
      return alarm;
    });

    if (alarms.length === 0) {
      alarms.push({
        state: AlarmState.ALARM,
        reason: `No alarms were found for the provided search terms: ${searchTerms.join(', ')}.`,
      });
    }
  } catch (e) {
    const message = 'Unable to retrieve alarms.';
    states.push({ reason: message, state: AlarmState.ALARM });
    console.error(message, e);
  }
  return states;
};

/**
 * Calculate and return an aggregate alarm state across alarms returned from all
 * CloudWatch clients provided. If any client errors are thrown, the returned state
 * will be ALARM.
 *
 */
export const getAggregateAlarmState = async (searchTerms: string[]): Promise<AggregateAlarmState> => {
  const alarmDetails: AlarmDetail[] = await getAlarms(searchTerms);

  return {
    alarmDetails,
    state: alarmDetails.find((a) => a.state === AlarmState.ALARM)?.state as AlarmState ?? AlarmState.OK,
    summary: `${alarmDetails
      .filter((a) => a.state === AlarmState.ALARM)
      .map((a) => a.reason)
      .join(' ')}`,
  };
};