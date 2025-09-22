import { Errors, logger } from 'common-model';
import { HandleResult, MessageHandler } from './MessageHandler';
import { IKafkaMessage, StreamHandler } from './StreamHandler';
import { IConf, IMessage } from './types';

export interface IContext<T> {
  id: string;
  txId: string;
  orgMsg: IMessage<T>;
  requestId?: string;
}

export type ApiHandler<T> = (request: T, ctx: IContext<T>) => HandleResult;

export interface ApiEndpoint<T> {
  uri: string;
  handler: ApiHandler<T>;
}

export abstract class AbstractController {

  private uriList: ApiEndpoint<any>[] = [];

  constructor(
    private readonly listenTopic: string,
    private readonly kafkaConfig: IConf,
    private readonly kafkaConsumerOptions?: any,
    private readonly kafkaTopicOptions?: any
  ) {
  }

  public init() {
    const handle: MessageHandler = new MessageHandler();
    logger.info('Starting Kafka stream handler', this.listenTopic);
    new StreamHandler(
      this.kafkaConfig,
      this.kafkaConsumerOptions,
      [this.listenTopic],
      (message: IKafkaMessage) => handle.handle(message, this.handle),
      this.kafkaTopicOptions
    );
    this.uriList = this.matchingList();
  }

  public abstract matchingList(): ApiEndpoint<any>[];

  public handle(message: IMessage<any>, orgMessage?: IKafkaMessage): HandleResult {
    if (message == null || message.data == null) {
      return Promise.reject(new Errors.SystemError());
    }

    const ctx: IContext<any> = {
      id: message.msgHandlerUniqueId || `${message.transactionId}_${message.messageId}`,
      txId: `${message.transactionId}`,
      orgMsg: message,
      requestId: message.data?.rId,
    };

    logger.info('Handling request', message.uri);
    
    for (let uri of this.uriList) {
      if (uri.uri === message.uri) {
        return uri.handler(message.data, ctx);
      }
    }
    return Promise.reject(new Errors.UriNotFound());
  }
}