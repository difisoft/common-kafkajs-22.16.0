import { IKafkaMessage, StreamHandler } from "./StreamHandler";
import { logger, Errors, Models, Utils } from "common-model";
import { IConf, IMessage, ISendMessage, MessageType, PromiseState } from "./types";
import { Kafka, Producer, ProducerRecord } from 'kafkajs';

class SendRequestCommon {
  protected messageId: number = 0;
  protected producer: Producer;
  protected readonly responseTopic: string;
  protected bufferedMessages: ISendMessage[] = [];
  protected producerReady: boolean = false;
  protected preferBatch: boolean;

  constructor(
    protected conf: IConf,
    protected handleSendError?: (e: Error) => boolean,
    producerOptions?: any,
    topicOptions?: any,
    protected readyStatusUpdate?: (isReady: boolean) => void,
    preferBatch?: boolean
  ) {
    this.preferBatch = preferBatch ?? false;
    this.responseTopic = `${this.conf.clusterId}.response.${this.conf.clientId}`;

    const kafka = new Kafka({
      clientId: conf.clientId,
      brokers: conf.kafkaUrls,
      ...conf.producerConfig
    });

    this.producer = kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
      ...producerOptions
    });

    this.connect();
  }

  private async connect() {
    try {
      await this.producer.connect();
      logger.info(this.preferBatch ? "high latency producer connect" : "low latency producer connect");
      this.changeProducerStatus(true);
      this.bufferedMessages.forEach(this.reallySendMessage);
    } catch (error) {
      logger.error("Failed to connect producer", error);
      this.changeProducerStatus(false);
    }
  }

  protected changeProducerStatus(isReady: boolean) {
    this.producerReady = isReady;
    this.readyStatusUpdate?.(this.producerReady);
  }

  public getResponseTopic(): string {
    return this.responseTopic;
  }

  public sendMessage(transactionId: string, topic: string, uri: string, data: any): void {
    const message: ISendMessage = this.createMessage(transactionId, topic, uri, data);
    this.sendMessageCheckReady(message);
  };

  public sendRaw(topic: string, data: any): void {
    const message: ISendMessage = {
      raw: true,
      message: data,
      topic: topic,
    };
    this.sendMessageCheckReady(message);
  };

  public sendForwardMessage(originMessage: any, newTopic: string, newUri: string): void {
    const message: ISendMessage = {
      topic: newTopic,
      message: originMessage
    };
    message.message.uri = newUri;
    this.sendMessageCheckReady(message);
  };

  public sendResponse(transactionId: string | number, messageId: string, topic: string, uri: string, data: any): void {
    const message: ISendMessage = this.createMessage(transactionId, topic, uri, data, MessageType.RESPONSE,
      undefined, undefined, messageId);
    this.sendMessageCheckReady(message);
  };

  public sendMessageCheckReady(message: ISendMessage) {
    if (!this.producerReady) {
      this.bufferedMessages.push(message);
      return;
    }
    this.reallySendMessage(message);
  }

  protected timeout(message: ISendMessage) {
    // do nothing
  }

  protected async doReallySendMessage(message: ISendMessage): Promise<void> {
    try {
      const msgContent = JSON.stringify(message.message);
      logger.info(`send low latency message ${msgContent} to topic ${message.topic}`);

      const record: ProducerRecord = {
        topic: message.topic,
        messages: [{
          value: Buffer.from(msgContent),
          timestamp: Date.now().toString()
        }]
      };

      await this.producer.send(record);

      if (message.timeout) {
        setTimeout(() => this.timeout(message), message.timeout);
      }
    } catch (e: any) {
      if (!this.handleSendError || !this.handleSendError(e)) {
        logger.error("error while sending the message", e);
      }
    }
  }

  protected reallySendMessage: (message: ISendMessage) => void = (message: ISendMessage) => {
    this.doReallySendMessage(message);
  };

  protected getMessageId(): string {
    this.messageId++;
    return `${this.messageId}`;
  }

  protected createMessage(transactionId: string | number, topic: string, uri: string
    , data: any, messageType: MessageType = MessageType.MESSAGE
    , responseTopic?: string, responseUri?: string, messageId?: string, timeout?: number): ISendMessage {
    return {
      topic: topic,
      message: {
        messageType: messageType,
        sourceId: this.conf.clusterId,
        messageId: messageId ? messageId : this.getMessageId(),
        transactionId: transactionId,
        uri: uri,
        responseDestination: responseTopic ? {
            topic: responseTopic,
            uri: responseUri
          }
          :
          undefined,
        data: data,
        t: timeout != null ? undefined : new Date().getTime(),
        et: timeout == null ? undefined : new Date().getTime() + timeout,
      }
    };
  };
}

class SendRequest extends SendRequestCommon {
  private requestedMessages: Map<string, ISendMessage> = new Map<string, ISendMessage>();
  private readonly expiredIn: number = 0;

  private consumerReady: boolean = false;

  constructor(
    conf: IConf,
    consumerOptions: any,
    initListener: boolean = true,
    topicConf: any = {},
    handleSendError?: (e: Error) => boolean,
    producerOptions?: any,
    readyCallback?: (isReady: boolean) => void,
    expiredIn?: number,
    preferBatch?: boolean
  ) {
    super(conf, handleSendError, producerOptions, topicConf, readyCallback, preferBatch);
    this.expiredIn = expiredIn ? expiredIn : 10000;
    if (initListener) {
      logger.info(`init response listener ${this.responseTopic}`);
      const topicOps = {...topicConf, "auto.offset.reset": "earliest"};
      new StreamHandler(this.conf, consumerOptions, [this.responseTopic]
        , (data: IKafkaMessage) => this.handlerResponse(data), topicOps, () => {
          logger.info("response consumer ready");
          this.consumerReady = true;
          this.fireStatus();
        }
      );
    } else {
      this.consumerReady = true;
      this.fireStatus();
    }
  }

  protected changeProducerStatus(isReady: boolean) {
    this.producerReady = isReady;
    this.fireStatus();
  }

  private fireStatus() {
    this.readyStatusUpdate?.(this.consumerReady && this.producerReady);
  }

  public async sendRequest(transactionId: string, topic: string, uri: string, data: any, timeout?: number): Promise<IMessage> {
    return this.sendRequestAsync(transactionId, topic, uri, data, timeout);
  }

  public async sendRequestAsync(transactionId: string, topic: string, uri: string, data: any, timeout?: number): Promise<IMessage> {
    const promise: PromiseState<IMessage> = new PromiseState();
    this.sendRequestBase(transactionId, topic, uri, data, promise, timeout);
    return promise.promise();
  };

  public sendRequestBase(transactionId: string, topic: string, uri: string, data: any, subject: PromiseState<IMessage>, timeout?: number) {
    const message: ISendMessage = this.createMessage(transactionId, topic, uri, data, MessageType.REQUEST
      , this.responseTopic, "REQUEST_RESPONSE", undefined, timeout);
    message.subject = subject;
    message.timeout = timeout;
    if (!this.producerReady) {
      this.bufferedMessages.push(message);
    } else {
      this.reallySendMessage(message);
    }
  };

  protected reallySendMessage: (message: ISendMessage) => void = (message: ISendMessage) => {
    if (message.subject) {
      this.requestedMessages.set(message.message.messageId, message);
    }
    super.doReallySendMessage(message);
  };

  protected timeout(message: ISendMessage) {
    const msgId: string = message.message.messageId;
    if (this.requestedMessages.has(msgId)) {
      this.respondError(message, new Errors.TimeoutError());
      this.requestedMessages.delete(msgId);
    }
  }

  private respondData(message: ISendMessage, data: IMessage) {
    if (message.subject == null) {
      return;
    }
    message.subject.resolve(data);
  }

  private respondError(message: ISendMessage, err: Error) {
    if (message.subject == null) {
      return;
    }
    message.subject.reject(err);
  }

  private handlerResponse(message: IKafkaMessage) {
    const msgStr = message.value.toString();
    try {
      if (message.timestamp != null && message.timestamp > 0 && this.expiredIn > 0 && Utils.diffMsTime(message.timestamp) > this.expiredIn) {
        logger.warn("ignore this request since it's expired %s", msgStr);
        return;
      }
    } catch (e) {
      logger.error("fail to handle message time", e);
    }
    const msg: IMessage = JSON.parse(msgStr);
    const data =  this.requestedMessages.get(msg.messageId);
    if (data != null) {
      this.respondData(data, msg);
      this.requestedMessages.delete(msg.messageId);
    } else {
      logger.warn(`cannot find where to response (probably timeout happen) "${msgStr}"`);
    }
  }
}

let instance: SendRequest | null = null;

function create(conf: IConf, consumerOptions: any,
                initResponseListener: boolean = true,
                topicConf: any = {},
                producerOptions: any = {},
                readyCallback?: (isReady: boolean) => void
): void {
  instance = new SendRequest(conf, consumerOptions, initResponseListener, topicConf, undefined, producerOptions, readyCallback);
}

function getInstance(): SendRequest {
  if (instance == null) {
    throw new Error("please call create first");
  }
  return instance;
}


function getResponse<T>(msg: IMessage): T {
  if (msg.data != null) {
    const response: Models.IResponse = msg.data;
    if (response.status != null) {
      throw Errors.createFromStatus(response.status);
    } else {
      return <T>response.data;
    }
  } else {
    logger.error("no data in response of message", msg);
    throw new Errors.GeneralError();
  }
}

export {
  SendRequest,
  SendRequestCommon,
  create,
  getInstance,
  getResponse
};