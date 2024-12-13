import * as rrweb from 'rrweb';

import type { eventWithTime } from '@rrweb/types';
import { recordOptions } from 'rrweb/typings/types';

type ErrorType = 'error' | 'unhandledrejection' | 'resource';

export interface CustomMonitorError {
  type: ErrorType,

  error: Error;
  message?: string | Event;
  stack?: string;
  source?: string;
  lineno?: number;
  colno?: number;
}

export interface MonitorOptions {
  /**
   * 记录时间
   */
  recordTime: number;

  /**
   * 延迟记录时间
   */
  deleyRecordTime: number;

  onRecordErrorEvents?: (
    events: eventWithTime[],
    blob: Blob,
    error: CustomMonitorError
  ) => void;

  onRecordError?: (
    error: CustomMonitorError) => void;

  /**
   * rrweb配置
   */
  rrwebRecordOptions?: Omit<recordOptions<eventWithTime>, 'emit'>;

  /**
   * 原始window对象
   */
  rawWindow: Window;

  uploadEventsFile?: (file: File) => Promise<string>
}

const defaultOptions: MonitorOptions = {
  recordTime: 1000 * 10, // 默认记录10s
  deleyRecordTime: 2 * 1000, // 默认延迟2s
  rawWindow: window
}

export class Monitor {
  private readonly options: MonitorOptions;
  private readonly eventsMatrix: eventWithTime[][] = [[]];

  constructor(opt: Partial<MonitorOptions>) {
    this.options = {
      ...defaultOptions,
      ...opt,
    }

    this.startRecord();

    this.initEvents();
  }

  private readonly startRecord = () => {
    const { eventsMatrix, options: {
      recordTime,
      rrwebRecordOptions
    } } = this

    rrweb.record({
      emit: (event, isCheckout) => {
        if (isCheckout) {
          // 保留最近一分钟的数据
          eventsMatrix.splice(0, eventsMatrix.length - 1);
          eventsMatrix.push([]);
        }
        const lastEvents = eventsMatrix[eventsMatrix.length - 1];
        lastEvents.push(event)
      },
      ...rrwebRecordOptions,
      checkoutEveryNms: recordTime,
    })
  }

  async recordAndReport(cb: (previewUrl: string) => Promise<any>) {
    return new Promise(async (resolve, reject) => {
      const { options: {
        deleyRecordTime,
        uploadEventsFile
      } } = this
      if (!cb) {
        return reject('cb is required') 
      }
      if (!uploadEventsFile) {
        return reject('uploadEventsFile is required')
      }
      await new Promise((r) => setTimeout(r, deleyRecordTime));
      const blob = new Blob([JSON.stringify(this.getRecordEvents())], { type: 'application/json' });
      const rrwebCdn = await uploadEventsFile(new File([blob], `errorRecord-${Date.now()}.json`));
      const previewUrl = `https://qgtiger.github.io/rrweb-preview/?url=${rrwebCdn}`

      cb(previewUrl).then(resolve).catch(reject);
    })
  }

  getRecordEvents = () => {
    const { eventsMatrix } = this
    const len = eventsMatrix.length;
    return (eventsMatrix[len - 2] || []).concat(eventsMatrix[len - 1]);
  }

  private recordErrorEvents(error: CustomMonitorError) {
    const { options: {
      onRecordErrorEvents,
      deleyRecordTime,
      onRecordError
    } } = this

    onRecordError && onRecordError(error);

    if (!onRecordErrorEvents) {
      return;
    }

    setTimeout(() => {
      const _events = this.getRecordEvents();
      const cloneEvents = JSON.parse(JSON.stringify(_events));
      const blob = new Blob([JSON.stringify(cloneEvents)], { type: 'application/json' });
      onRecordErrorEvents && onRecordErrorEvents(cloneEvents, blob, error);
    }, deleyRecordTime)
  }

  private initEvents() {
    const { rawWindow } = this.options;
    rawWindow.onerror = (message, source, lineno, colno, error) => {
      error && this.recordErrorEvents({
        type: 'error',

        message,
        source,
        lineno,
        colno,
        stack: error.stack,
        error
      });
      // 返回true，阻止默认行为
      return true
    }

    // 监听资源加载错误
    rawWindow.addEventListener('error', (event) => {
      if (event.target && (event.target as any).src) {
        this.recordErrorEvents({
          type: 'resource',

          message: '资源加载错误, 资源路劲: ' + (event.target as any).src,
          source: (event.target as any).src,
          error: event.error
        });
      }
      return true
    }, true)

    // 监听promise错误
    rawWindow.addEventListener('unhandledrejection', (event) => {
      this.recordErrorEvents({
        type: 'unhandledrejection',

        message: event.reason,
        error: event.reason
      });
      // 返回true，阻止默认行为
      return true
    })
  }
}