import { Errors, logger } from 'common-model';
import { HandleResult, MessageHandler } from './MessageHandler';
import { IKafkaMessage, ConsumerHandler } from './ConsumerHandler';
import { convertMessageType, IMessage } from './types';
import { ConsumerConfig, KafkaConfig, ProducerConfig } from 'kafkajs';
import { ProducerCommon } from './KafkaRequester';

export interface IContext<T> {
  id: string;
  txId: string;
  orgMsg: IMessage<T>;
  requestId?: string;
}

export function convertContextType<T, R>(ctx: IContext<T>, data: R): IContext<R> {
  return {
    id: ctx.id,
    txId: ctx.txId,
    orgMsg: convertMessageType<T, R>(ctx.orgMsg, data),
    requestId: ctx.requestId,
  };
}

export type ApiHandler<T> = (request: T, ctx: IContext<T>) => HandleResult;

export interface ApiEndpoint<T> {
  uri: string;
  handler: ApiHandler<T>;
  /**
   * if not specify, we will use default scope group
   * if specify as empty, mean not publish this scope to ADMIN only.
   */
  scopeGroups?: string[];
  /**
   * auto generated from uri
   */
  operationId?: string;
}

// 1. Break serviceName into words (split kebab and camelcase)
function splitServiceName(name: string): string[] {
  // split kebab-case first
  let parts = name.split('-');
  // further split each part by camelCase
  let camelParts: string[] = [];
  for (const part of parts) {
    camelParts.push(...part.split(/(?=[A-Z])/));
  }
  return camelParts.filter(Boolean);
}

// 2. For URI, split into method and path, then split path by / and remove empty parts
function splitUri(uri: string): string[] {
  let [method, path] = uri.split(':', 2);
  let parts: string[] = [];
  if (method) {
    parts.push(method);
  }
  if (path) {
    parts.push(...path.split('/').filter(Boolean));
  }
  return parts;
}

export function generateOperatorId(serviceName: string, uri: string) {
  // Convert serviceName (camelCase or kebab-case) and uri ("get:api/v1/foo") to ABC_DEF_GHI_OPQ_URIPARTS
  // Example: serviceName = "myService-qweRty", uri = "get:api/v1/favourites" 
  // result: MY_SERVICE_QWE_RTY_GET_API_V1_FAVOURITES

  const nameParts = splitServiceName(serviceName);
  const uriParts = splitUri(uri);

  // Concatenate, uppercase, join by _
  return [...nameParts, ...uriParts]
    .map(x => x.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())
    .filter(Boolean)
    .join('_');
}

export abstract class AbstractKafkaController {

  private uriList: ApiEndpoint<any>[] = [];

  constructor(
    private readonly serviceName: string,
    private readonly clusterId: string,
    private readonly kafkaOptions: KafkaConfig,
    private readonly consumerOptions: Omit<ConsumerConfig, "groupId">,
    private readonly producerOptions: ProducerConfig
  ) {
    // # bind methods to this
    this.init = this.init.bind(this);
    this.handle = this.handle.bind(this);
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

  protected abstract matchingList(): ApiEndpoint<any>[];

  protected abstract getOpenApiFilePath(): string;

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