import * as rrweb from 'rrweb';
import type { eventWithTime } from '@rrweb/types';
import { recordOptions } from 'rrweb/typings/types';

export interface CustomMonitorError {
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
}

const defaultOptions: MonitorOptions = {
  recordTime: 1000 * 10, // 默认记录10s
  deleyRecordTime: 2 * 1000
}

export class Monitor {
  private readonly options: MonitorOptions;
  private readonly events: eventWithTime[] = [];

  constructor(opt: Partial<MonitorOptions>) {
    this.options = {
      ...defaultOptions,
      ...opt,
    }

    this.startRecord();

    this.initEvents();
  }

  private readonly startRecord = () => {
    const { events, options: {
      recordTime,
      rrwebRecordOptions
    } } = this

    function pushEvent(event: eventWithTime) {
      events.push(event);
      let i = 0;
      while (i < events.length) {
        if (events[i].timestamp + recordTime > event.timestamp) {
          break;
        }
        i++;
      }
      // 保留最近一分钟的数据
      events.splice(0, i);
    }

    rrweb.record({
      emit: (event) => {
        pushEvent(event)
      },
      ...rrwebRecordOptions
    })
  }

  private recordErrorEvents(error: CustomMonitorError) {
    const { events, options: {
      onRecordErrorEvents,
      deleyRecordTime,
      onRecordError
    } } = this

    onRecordError && onRecordError(error);

    setTimeout(() => {
      const cloneEvents = events.slice();
      const blob = new Blob([JSON.stringify(cloneEvents)], { type: 'application/json' });
      onRecordErrorEvents && onRecordErrorEvents(cloneEvents, blob, error);
    }, deleyRecordTime)
  }

  private initEvents() {
    window.onerror = (message, source, lineno, colno, error) => {
      error && this.recordErrorEvents({
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
    window.addEventListener('error', (event) => {
      this.recordErrorEvents({
        message: event.message,
        source: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });
      // 返回true，阻止默认行为
      return true
    })

    // 监听promise错误
    window.addEventListener('unhandledrejection', (event) => {
      this.recordErrorEvents({
        message: event.reason,
        error: event.reason
      });
      // 返回true，阻止默认行为
      return true
    })
  }
}