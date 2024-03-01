import {loggerAppRolling, loggerDebug, loggerTest, Logger } from "@foxxmd/logging";

export type AppLogger = Logger

export const testPinoLogger = loggerTest;

export const initPinoLogger = loggerDebug;

export const appPinoLogger = loggerAppRolling;
