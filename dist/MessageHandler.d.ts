import { IMessage } from "./types";
import { Models } from "common-model";
import { ProducerCommon } from "./KafkaRequester";
import { IKafkaMessage } from "./ConsumerHandler";
declare type HandleResult = Promise<any> | boolean;
declare type Handle = (msg: IMessage<any>, originalMessage?: IKafkaMessage) => HandleResult;
declare class MessageHandler {
    private producer;
    protected activeRequestMap: {
        [k: string]: IMessage<any>;
    };
    private timeoutinMs?;
    private requestId;
    constructor(producer: ProducerCommon, timeoutinMs?: number);
    private getMsgHandlerUniqueId;
    getActiveMessage: (msgId: string) => IMessage<any> | undefined;
    handle: (message: IKafkaMessage, func: Handle) => void;
    getErrorMessage: (error: Error) => Models.IResponse;
    private shouldResponse;
}
declare function getErrorMessage(err: Error): Models.IResponse;
export { HandleResult, Handle, MessageHandler, getErrorMessage, };
