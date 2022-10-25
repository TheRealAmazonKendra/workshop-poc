import fs from 'fs';
import path from 'path';
import { OnEventRequest, OnEventResponse } from 'aws-cdk-lib/custom-resources/lib/provider-framework/types'; // eslint-disable-line import/no-unresolved
import { S3, SSM } from 'aws-sdk';
import { CalendarSourceType } from './calendar';

export const handler = async (event: OnEventRequest): Promise<OnEventResponse> => {
  console.log('Event: %j', { ...event, ResponseURL: '...' });

  const calendarPath = event.ResourceProperties.calendarPath;
  const calendarName = event.ResourceProperties.calendarName;

  let calendar: string;

  if (event.ResourceProperties.sourceType === CalendarSourceType.PATH) {
    calendar = fs.readFileSync(path.join(calendarPath, calendarName), { encoding: 'utf-8' });
  } else {
    const s3 = new S3();
    calendar = (await s3.getObject({
      Bucket: calendarPath,
      Key: calendarName,
    }).promise()).Body!.toString();
  }

  const ssm = new SSM();

  if (event.RequestType === 'Create') {
    const createDocumentRepsonse = await ssm.createDocument({
      Name: calendarName,
      Content: calendar,
    }).promise();
    console.log('Create document: %j', createDocumentRepsonse);
  }

  if (event.RequestType === 'Update') {
    const updateDocumentResponse = await ssm.updateDocument({
      Name: calendarName,
      Content: calendar,
    }).promise();
    console.log('Update document: %j', updateDocumentResponse);
  }

  if (event.RequestType === 'Delete') {
    const deleteDocumentResponse = await ssm.deleteDocument({
      Name: calendarName,
    }).promise();
    console.log('Delete document: %j', deleteDocumentResponse);
  }

  return {};
};