import { IStage } from 'aws-cdk-lib/aws-codepipeline';
import { Calendar } from '../calendar/calendar';
import { getCalendarState } from '../calendar/calendar-state';
import { getAggregateAlarmState } from './alarm-state';
import { ChangeControlAlarmProps } from './change-controller';
import { disableStageTransition, enableStageTransition, getStageState } from './codepipeline-states';

export interface ChangeControllerEvent {
  calendar: Calendar;
  changeControlAlarmProps: ChangeControlAlarmProps;
  stage: IStage;
};

export const handler = async (event: ChangeControllerEvent, context: any): Promise<void> => {
  const pipelineName = event.stage.pipeline.pipelineName;
  const stageName = event.stage.stageName;

  const calendarState = await getCalendarState(event.calendar.calendarName);
  const stageState = await getStageState(pipelineName, stageName);
  const alarmState = await getAggregateAlarmState({
    pipelineName,
    stageName,
    roleArn: event.changeControlAlarmProps.roleArn,
    searchTerms: event.changeControlAlarmProps.searchTerms,
  });

  const input = { pipelineName: pipelineName, stageName: stageName, transitionType: 'Inbound' };
  if (calendarState.state === 'OPEN' && alarmState.state === 'OK') {
    console.log(`Enabling transition: ${JSON.stringify(input, null, 2)}`);
    await enableStageTransition(input, context.functionName, stageState);
  } else {
    // If in ALARM, use that as the reason instead of the calendar.
    const reason = alarmState.state === 'ALARM' ? alarmState.summary : calendarState.summary;
    const disableInput = { ...input, reason };
    console.log(`Disabling transition: ${JSON.stringify(disableInput, null, 2)}`);
    await disableStageTransition(disableInput, context.functionName, stageState);
  }
};