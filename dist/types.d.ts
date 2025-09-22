import { ConsumerConfig, ProducerConfig } from 'kafkajs';
interface IConf {
    clientId: string;
    clusterId: string;
    kafkaUrls: string[];
    consumerConfig?: ConsumerConfig;
    producerConfig?: ProducerConfig;
}
declare enum MessageType {
    MESSAGE = "MESSAGE",
    REQUEST = "REQUEST",
    RESPONSE = "RESPONSE"
}
declare class PromiseState<T> {
    private rs?;
    private rj?;
    private prom;
    constructor();
    resolve(v: T): void;
    reject(err: Error): void;
    promise(): Promise<T>;
}
declare interface ISendMessage {
    topic: string;
    subject?: PromiseState<IMessage<any>>;
    message: IMessage<any> | any;
    timeout?: number;
    sendType?: number;
    raw?: boolean;
}
declare interface IResponseDestination {
    topic: string;
    uri: string;
}
declare interface IMessage<T> {
    messageType: MessageType;
    sourceId?: string;
    messageId: string;
    transactionId: string | number;
    uri?: string;
    responseDestination?: IResponseDestination;
    data: T;
    t?: number;
    et?: number;
    stream?: boolean;
    streamState?: string;
    streamIndex?: number;
    msgHandlerUniqueId?: string;
}
declare const STREAM_STATE: {
    NORMAL: string;
    FINSISH: string;
    ERROR: string;
};
export { IConf, MessageType, ISendMessage, IMessage, IResponseDestination, PromiseState, STREAM_STATE, };
