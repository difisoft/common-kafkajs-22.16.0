import { IConf, IMessage, ISendMessage, MessageType, PromiseState } from "./types";
import { Producer } from 'kafkajs';
declare class SendRequestCommon {
    protected conf: IConf;
    protected handleSendError?: ((e: Error) => boolean) | undefined;
    protected readyStatusUpdate?: ((isReady: boolean) => void) | undefined;
    protected messageId: number;
    protected producer: Producer;
    protected readonly responseTopic: string;
    protected bufferedMessages: ISendMessage[];
    protected producerReady: boolean;
    protected preferBatch: boolean;
    constructor(conf: IConf, handleSendError?: ((e: Error) => boolean) | undefined, producerOptions?: any, topicOptions?: any, readyStatusUpdate?: ((isReady: boolean) => void) | undefined, preferBatch?: boolean);
    private connect;
    protected changeProducerStatus(isReady: boolean): void;
    getResponseTopic(): string;
    sendMessage(transactionId: string, topic: string, uri: string, data: any): void;
    sendRaw(topic: string, data: any): void;
    sendForwardMessage(originMessage: any, newTopic: string, newUri: string): void;
    sendResponse(transactionId: string | number, messageId: string, topic: string, uri: string, data: any): void;
    sendMessageCheckReady(message: ISendMessage): void;
    protected timeout(message: ISendMessage): void;
    protected doReallySendMessage(message: ISendMessage): Promise<void>;
    protected reallySendMessage: (message: ISendMessage) => void;
    protected getMessageId(): string;
    protected createMessage(transactionId: string | number, topic: string, uri: string, data: any, messageType?: MessageType, responseTopic?: string, responseUri?: string, messageId?: string, timeout?: number): ISendMessage;
}
declare class SendRequest extends SendRequestCommon {
    private requestedMessages;
    private readonly expiredIn;
    private consumerReady;
    constructor(conf: IConf, consumerOptions: any, initListener?: boolean, topicConf?: any, handleSendError?: (e: Error) => boolean, producerOptions?: any, readyCallback?: (isReady: boolean) => void, expiredIn?: number, preferBatch?: boolean);
    protected changeProducerStatus(isReady: boolean): void;
    private fireStatus;
    sendRequest(transactionId: string, topic: string, uri: string, data: any, timeout?: number): Promise<IMessage>;
    sendRequestAsync(transactionId: string, topic: string, uri: string, data: any, timeout?: number): Promise<IMessage>;
    sendRequestBase(transactionId: string, topic: string, uri: string, data: any, subject: PromiseState<IMessage>, timeout?: number): void;
    protected reallySendMessage: (message: ISendMessage) => void;
    protected timeout(message: ISendMessage): void;
    private respondData;
    private respondError;
    private handlerResponse;
}
declare function create(conf: IConf, consumerOptions: any, initResponseListener?: boolean, topicConf?: any, producerOptions?: any, readyCallback?: (isReady: boolean) => void): void;
declare function getInstance(): SendRequest;
declare function getResponse<T>(msg: IMessage): T;
export { SendRequest, SendRequestCommon, create, getInstance, getResponse };
