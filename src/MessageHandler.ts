import { IMessage } from "@/types";
import { logger, Errors, Models } from "common-model";
import { getInstance, SendRequest } from "@/SendRequest";
import { IKafkaMessage } from "@/StreamHandler";

declare type HandleResult = Promise<any> | boolean;
declare type Handle = (msg: IMessage, originalMessage?: IKafkaMessage) => HandleResult;

class MessageHandler {
  protected activeRequestMap: {[k: string]: IMessage} = {};
  private timeoutinMs?: number;
  private requestId: number = new Date().getTime();
  private sendRequest: SendRequest;
  
  constructor(sendRequest: SendRequest | null | undefined = null, timeoutinMs?: number) {
    if (sendRequest == null) {
      this.sendRequest = getInstance();
    } else {
      this.sendRequest = sendRequest;
    }
    this.timeoutinMs = timeoutinMs;
    if (this.timeoutinMs == null && process.env.TRADEX_ENV_DEFAULT_REQUEST_TIMEOUT != null  && process.env.TRADEX_ENV_DEFAULT_REQUEST_TIMEOUT !== '') {
      try {
        this.timeoutinMs = parseInt(process.env.TRADEX_ENV_DEFAULT_REQUEST_TIMEOUT, 10);
      } catch (e) {
        logger.error("wrong timeout setting", process.env.TRADEX_ENV_DEFAULT_REQUEST_TIMEOUT);
      }
    }
  }

  private getMsgHandlerUniqueId(msg: IMessage) {
    if (msg.msgHandlerUniqueId == null) {
      msg.msgHandlerUniqueId = `${msg.transactionId}_${msg.messageId}_${this.requestId}`;
    }
    return msg.msgHandlerUniqueId;
  }

  public getActiveMessage: (msgId: string) => IMessage | undefined = (msgId: string) => {
    return this.activeRequestMap[msgId];
  };

  public handle: (message: IKafkaMessage, func: Handle) => void = (message: IKafkaMessage, func: Handle) => {
    if (message.value == null) {
      return;
    }
    const msgString: string = message.value.toString();
    try {
      const startTime: [number, number] = process.hrtime();
      let diff: [number, number] | null = null;
      logger.info(`receive msg: ${msgString}`);
      const msg: IMessage = JSON.parse(msgString);
      if (msg.t != null && this.timeoutinMs != null && new Date().getTime() - msg.t > this.timeoutinMs) {
        logger.warn(`ignore ${msg.uri} ${msg.transactionId} - ${msg.messageId} since it's time out`);
        return;
      }
      if (msg.et != null && new Date().getTime() > msg.et) {
        logger.warn(`ignore ${msg.uri} ${msg.transactionId} - ${msg.messageId} since it's time out`);
        return;
      }
      const shouldResponse = this.shouldResponse(msg);
      if (shouldResponse && msg.uri === "/healthcheck") {
        this.sendRequest.sendResponse(
          msg.transactionId,
          msg.messageId,
          msg.responseDestination!.topic,
          msg.responseDestination!.uri,
          {
            status: "ON",
          }
        );
        return;
      }
      this.requestId += 1;
      this.activeRequestMap[this.getMsgHandlerUniqueId(msg)] = msg;
      const obs: HandleResult = func(msg, message);
      if (obs === false) {
        if (shouldResponse) {
          diff = process.hrtime(startTime);
          logger.info(`process request ${msg.uri} took ${diff[0]}.${diff[1]} seconds`);
          this.sendRequest.sendResponse(
            msg.transactionId,
            msg.messageId,
            msg.responseDestination!.topic,
            msg.responseDestination!.uri,
            this.getErrorMessage(new Errors.UriNotFound())
          );
        }
        delete this.activeRequestMap[this.getMsgHandlerUniqueId(msg)];
        return;
      } else if (obs === true) {
        diff = process.hrtime(startTime);
        logger.info(`forward request ${msg.transactionId} ${msg.messageId} ${msg.uri} took ${diff[0]}.${diff[1]} seconds`);
        delete this.activeRequestMap[this.getMsgHandlerUniqueId(msg)];
        return; // forwarding. do nothing
      } else {
        const handleError = (err: Error) => {
          logger.error(`error while processing request ${msg.transactionId} ${msg.messageId} ${msg.uri}`, err);
          delete this.activeRequestMap[this.getMsgHandlerUniqueId(msg)];
          if (err instanceof Errors.NoForwardResponseError) {
            return;
          }
          if (shouldResponse) {
            this.sendRequest.sendResponse(
              msg.transactionId,
              msg.messageId,
              msg.responseDestination!.topic,
              msg.responseDestination!.uri,
              this.getErrorMessage(err)
            );
          }
          diff = process.hrtime(startTime);
          logger.info(`handle request ${msg.transactionId} ${msg.messageId} ${msg.uri} took ${diff[0]}.${diff[1]} seconds`);
        };
        const handleData = (data: any) => {
          delete this.activeRequestMap[this.getMsgHandlerUniqueId(msg)];
          try {
            if (shouldResponse) {
              this.sendRequest.sendResponse(
                <string>msg.transactionId,
                msg.messageId,
                msg.responseDestination!.topic,
                msg.responseDestination!.uri,
                {data: data}
              );
            }
            diff = process.hrtime(startTime);
            logger.info(`handle request ${msg.uri} took ${diff[0]}.${diff[1]} seconds`);
          } catch (err: any) {
            if (err instanceof Error) {
              handleError(err);
            } else {
              handleError(new Error(JSON.stringify(err)));
            }
          }
        }
        if (obs instanceof Promise) {
          obs.then(handleData).catch(handleError);
        }
      }
    } catch (e) {
      logger.error(`error while processing message ${message.topic} ${message.value} ${msgString}`, e);
    }
  };

  public getErrorMessage = (error: Error) => {
    return getErrorMessage(error);
  };

  private shouldResponse(msg: IMessage) {
    return msg.responseDestination != null && msg.responseDestination.topic != null;
  }
}

function getErrorMessage(err: Error): Models.IResponse {
  if (err instanceof Errors.GeneralError) {
    const error = err as Errors.GeneralError;
    if (error.isSystemError) {
      if (error.source) {
        logger.error('error', error.source);
      } else {
        logger.error('error', error);
      }
      return Models.createFailResponse(error.code, error.messageParams,
        (error.params && error.params.length > 0) ? error.params : undefined);
    } else if (error instanceof Errors.ForwardError) {
      return {status: error.status};
    } else {
      logger.error('error', error);
      return Models.createFailResponse('INTERNAL_SERVER_ERROR');
    }
  } else {
    return getErrorMessage(new Errors.GeneralError());
  }
  
}

export {
  HandleResult,
  Handle,
  MessageHandler,
  getErrorMessage,
}