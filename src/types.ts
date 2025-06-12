import { ConsumerConfig, ProducerConfig } from 'kafkajs';

interface IConf {
  clientId: string;
  clusterId: string;
  kafkaUrls: string[];
  consumerConfig?: ConsumerConfig;
  producerConfig?: ProducerConfig;
}

enum MessageType {
  MESSAGE = 'MESSAGE',
  REQUEST = 'REQUEST',
  RESPONSE = 'RESPONSE',
}

class PromiseState<T> {
  private rs?: (v: T) => void;
  private rj?: (err: Error) => void;
  private prom: Promise<T>;

  public constructor() {
    // tslint:disable
    this.prom = new Promise<T>((resolve: (v: T) => void, reject: (err: Error) => void) => {
      this.rs = resolve;
      this.rj = reject;
    });
    // tslint:enable
  }

  public resolve(v: T) {
    this.rs?.(v);
  }

  public reject(err: Error) {
    this.rj?.(err);
  }

  public promise(): Promise<T> {
    return this.prom;
  }
}

declare interface ISendMessage {
  topic: string,
  subject?: PromiseState<IMessage>,
  message: IMessage | any,
  timeout?: number,
  sendType?: number,
  raw?: boolean,
}

declare interface IResponseDestination {
  topic: string,
  uri: string,
}

declare interface IMessage {
  messageType: MessageType,
  sourceId?: string,
  messageId: string,
  transactionId: string | number,
  uri?: string,
  responseDestination?: IResponseDestination,
  data: any,
  t?: number, // time message is sent
  et?: number, // time message is expired
  stream?: boolean,
  streamState?: string;
  streamIndex?: number;
  msgHandlerUniqueId?: string; // this will included by request handler automatically
}

const STREAM_STATE = {
  NORMAL: "NORMAL",
  FINSISH: "FINSISH",
  ERROR: "ERROR",
};

export {
  IConf,
  MessageType,
  ISendMessage,
  IMessage,
  IResponseDestination,
  PromiseState,
  STREAM_STATE,
};