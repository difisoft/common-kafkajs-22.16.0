import { IMessage } from "./types";
import { Models } from "common-model";
import { SendRequest } from "./SendRequest";
import { IKafkaMessage } from "./StreamHandler";
declare type HandleResult = Promise<any> | boolean;
declare type Handle = (msg: IMessage, originalMessage?: IKafkaMessage) => HandleResult;
declare class MessageHandler {
    protected activeRequestMap: {
        [k: string]: IMessage;
    };
    private timeoutinMs?;
    private requestId;
    private sendRequest;
    constructor(sendRequest?: SendRequest | null | undefined, timeoutinMs?: number);
    private getMsgHandlerUniqueId;
    getActiveMessage: (msgId: string) => IMessage | undefined;
    handle: (message: IKafkaMessage, func: Handle) => void;
    getErrorMessage: (error: Error) => Models.IResponse;
    private shouldResponse;
}
declare function getErrorMessage(err: Error): Models.IResponse;
export { HandleResult, Handle, MessageHandler, getErrorMessage, };
