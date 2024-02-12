import dayjs, {Dayjs} from "dayjs";
import utc from 'dayjs/plugin/utc.js';
import isBetween from 'dayjs/plugin/isBetween.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import duration from 'dayjs/plugin/duration.js';
import timezone from 'dayjs/plugin/timezone.js';
import winstonDef from '@foxxmd/winston';
import {NullTransport} from 'winston-null';

const {loggers, transports} = winstonDef;

if(!loggers.has('noop')) {
    loggers.add('noop', {transports: [new NullTransport()]});
}

dayjs.extend(utc)
dayjs.extend(isBetween);
dayjs.extend(relativeTime);
dayjs.extend(duration);
dayjs.extend(timezone);
