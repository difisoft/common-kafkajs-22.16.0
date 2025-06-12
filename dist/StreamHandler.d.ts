import { IConf } from "./types";
interface IKafkaMessage {
    value: Buffer;
    size: number;
    topic: string;
    offset: string;
    partition: number;
    key: string;
    timestamp: number;
}
declare class StreamHandler {
    private consumer;
    private isRunning;
    constructor(conf: IConf, options: any, topics: string[], dataHandler: (data: IKafkaMessage, handler: StreamHandler) => void, topicConf?: any, readyCallback?: () => void);
    private start;
    close(): Promise<void>;
}
declare function createBroadcastListener(conf: IConf, options: any, topics: string[], dataHandler: (data: IKafkaMessage, handler: StreamHandler) => void, topicConf?: any): StreamHandler;
export { StreamHandler, IKafkaMessage, createBroadcastListener };
