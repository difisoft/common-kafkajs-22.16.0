import { Errors, logger } from 'common-model';
import { HandleResult, MessageHandler } from './MessageHandler';
import { IKafkaMessage, ConsumerHandler } from './ConsumerHandler';
import { IMessage } from './types';
import { ConsumerConfig, KafkaConfig, ProducerConfig } from 'kafkajs';
import { ProducerCommon } from './KafkaRequester';

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

export abstract class AbstractKafkaController {

  private uriList: ApiEndpoint<any>[] = [];

  constructor(
    private readonly clusterId: string,
    private readonly kafkaOptions: KafkaConfig,
    private readonly consumerOptions: Omit<ConsumerConfig, "groupId">,
    private readonly producerOptions: ProducerConfig
  ) {
  }

  public init() {
    const handle: MessageHandler = new MessageHandler(
      new ProducerCommon(this.clusterId, this.kafkaOptions, this.producerOptions)
    );
    logger.info('Starting Kafka stream handler', this.clusterId);
    new ConsumerHandler(
      this.kafkaOptions,
      {
        groupId: this.clusterId,
        ...this.consumerOptions
      },
      [this.clusterId],
      (message: IKafkaMessage) => handle.handle(message, this.handle),
      () => {
        logger.info('Kafka stream handler ready');
      }
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