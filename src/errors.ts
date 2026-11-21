/** SDK 类型化错误：宿主 catch 后按 code 映射为中文提示，不暴露堆栈。 */
export class ExplainVideoError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = 'ExplainVideoError';
    this.code = code;
    this.details = details;
  }
}

/** 传入的数据不符合时间轴契约 */
export class InvalidVideoError extends ExplainVideoError {
  constructor(message: string, details?: unknown) {
    super(message, 'INVALID_VIDEO', details);
    this.name = 'InvalidVideoError';
  }
}

/** 时间越界 / 查找失败 */
export class TimelineError extends ExplainVideoError {
  constructor(message: string, details?: unknown) {
    super(message, 'TIMELINE_ERROR', details);
    this.name = 'TimelineError';
  }
}
