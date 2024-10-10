
import EventEmitter from 'eventemitter3';

export class StreamLoader extends EventEmitter {
  static EVENTS = [
    'getcontentbytelength',
    'read',
    'load',
  ];
  constructor() {
    super();
  }
  load(path: string, option?: RequestInit): Promise<void> {
    return new Promise(async (resolve) => {
      const response = await fetch(path, option);
      if (response.status !== 200) {
        throw new Error(`failed to load: [ ${response.status} ]`);
      }
      const contentLength = +(response.headers.get('content-length'));
      this.emit('getcontentbytelength', contentLength);

      const readableStreamReader = response.body.getReader();
      while (true) {
        const {value, done} = await readableStreamReader.read();
        if (done === true) {
          this.emit('load');
          resolve();
          break;
        } else {
          this.emit('read', value);
        }
      }
    });
  }
}
