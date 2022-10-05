// ---- ----
import {JSONMessageQueue,ResponseVector} from 'message-relay-services'
import { EventEmitter } from 'events'



class CommunicatorAPI extends EventEmitter {
    //
    constructor() {
        super()
    }

    // ---- ---- ---- ---- ---- ---- ----
    async publish(topic,path,message) {
        if ( !(topic) || !(path) ) return false
        if ( !(message) ) return false
        message._ps_op = "pub"
        message.topic = topic
        message._m_path = path
        try {
            return await this.sendMessage(message)            
        } catch (e) {
            console.log(e)
            return false
        }
    }

    
    // ---- ---- ---- ---- ---- ---- ---- ----
    //
    async subscribe(topic,path,message,handler) {
        if ( !(topic) || !(path) ) return false
        if ( (typeof message === 'function') && (handler === undefined) ) {
            handler = message
            message = {}
        } else if ( (typeof message === 'boolean')  && (typeof message === 'function') ) {
            message = {}
        } else if (handler === undefined ) {
            return false
        } 
        if ( handler !== undefined && (typeof handler === "function") ) {
            this.on(`update-${topic}-${path}`,handler)
            this.subcriptions[`update-${topic}-${path}`] = handler
        }
        message._ps_op = "sub"
        message.topic = topic
        message._m_path = path
        try {
            return await this.sendMessage(message)            
        } catch (e) {
            console.log(e)
            return false
        }
    }

    // ---- ---- ---- ---- ---- ---- ----
    async unsubscribe(topic,path) {
        if ( !(topic) || !(path) ) return false
        let handler = this.subcriptions[`update-${topic}-${path}`]
        if ( handler ) {
            this.removeListener(`update-${topic}-${path}`,handler)
            delete this.subcriptions[`update-${topic}-${path}`]
        }
        let message = {
            "_ps_op" : "unsub",
            "topic" : topic
        }
        message._m_path = path
        try {
            return await this.sendMessage(message)            
        } catch (e) {
            console.log(e)
            return false
        }
    }


    //
    send(message) {     // sometimes synonyms help
        if ( !(message) ) return false
        return this.sendMessage(message)
    }

    //      returns a promise
    send_on_path(message,path) {
        try {
            let msg = Object.assign({},message)
            msg['_m_path'] = path
            return this.sendMessage(msg)
        } catch (e) {
            console.error(e)
            return false
        }
    }

    send_op_on_path(message,path,op) {
        if ( !(message) ) return false
        message._tx_op = op
        return this.send_on_path(message,path)
    }

    get_on_path(message,path) {
        if ( !(message) ) return false
        message._tx_op = 'G'
        return this.send_on_path(message,path)
    }

    set_on_path(message,path) {
        if ( !(message) ) return false
        message._tx_op = 'S'
        return this.send_on_path(message,path)
    }

    mod_on_path(message,path) {
        if ( !(message) ) return false
        message._tx_op = 'M'
        return this.send_on_path(message,path)
    }

    del_on_path(message,path) {
        if ( !(message) ) return false
        message._tx_op = 'D'
        return this.send_on_path(message,path)
    }

    publication_on_path(message,path) {
        if ( !(message) ) return false
        message._tx_op = 'P'
        return this.send_on_path(message,path)
    }

    unpublish_on_path(message,path) {
        if ( !(message) ) return false
        message._tx_op = 'U'
        return this.send_on_path(message,path)
    }

}


export class Communicator extends CommunicatorAPI  {

    constructor(conf,wrapper,skip_init) {
        //
        super()
        //
        this.subcriptions = {}
        if ( conf.JSONMessageQueueClass ) {
            let mqClass = require(conf.JSONMessageQueueClass)
            this.messages = new mqClass(false)
        } else {
            this.messages = new JSONMessageQueue(false)
        }
        //
        try {
            this.resp_vector = !(conf.response_vector) ? new ResponseVector(conf) : new (require(conf.response_vector))
        } catch (e) {
            this.resp_vector = new ResponseVector(conf)
        }
        //
        //
        this.writer = false     // The writer is set by the descendant... perhaps tcp udp websocket, etc.
        this.event_wrapper = false
        if ( wrapper ) {
             this.event_wrapper = wrapper
        }
        //
        if ( !(skip_init) ) {
            this._init(conf)
        }
    }


    _init(conf) { 
        throw new Error("Descedant of class Messenger must implement _init.")
    }

    //
    _handle_unsolicited(message) {
        if ( message !== undefined ) {
            let topic = message.topic
            let path = message._m_path
            this.emit(`update-${topic}-${path}`,message)
        } 
    }
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    // INBOUND MESSAGE DATA
    // The inbound message handlers (responses and unsolicited on this client socket)
    client_add_data_and_react(data) {
        let mqueue = this.messages
        mqueue.add_data(data)
        mqueue.message_complete()
        let message = undefined
        while ( mqueue.message_queue.length ) {
            message = mqueue.dequeue()
            if ( message._response_id !== undefined ) {
                let resolver = this.resp_vector.get_response_resolver(message._response_id)
                if ( typeof resolver === "function" ) {
                    resolver(message)
                } else {
                    /*
                    let e = new Error("did not have resolver on record")
                    */
                }
            } else {
                this._handle_unsolicited(message)
            }
        }
    }

    // OUTBOUND MESSAGE DATA
    _message_and_response(message,resolve,reject) {
        let id = this.resp_vector.get_response_id()
        if ( id < 0 ) {
            reject(new Error("send message max out... is server up?"))
        }
        message._response_id = id   // overwrites this if sender copied a forwarded object...
        let message_handler = (msg) => { 
            this.resp_vector.unlock_response_id(id);
            resolve(msg) 
        }
        this.resp_vector.lock_response_id(id,message_handler)
        //
        // write message
        let flat_message = this.messages.encode_message(message)

        if ( this.writer ) {
            //
            let err_handler = (err) => {
                this.writer.removeListener('error',err_handler)
                reject(err);
            }
            this.writer.on('error',err_handler);
            try {
                this.writer.write(flat_message);            // write message here....
            } catch (e) {
                this.resp_vector.unlock_response_id(id)
                console.log(e)
            } finally {
                // might reserve this until the response is received
                this.writer.removeListener('error',err_handler)
            }
            //
        }
    }

    //
    // sendMessage
    // ---- ---- ---- ---- ---- ---- ---- ---- ----
    //
    // This sends messages to IP endpoints. But, it may also write to a file if that has been setup through configuration 
    // with files_only. Another reason data may be place in files is that the socket may close or be broken in some way.
    //
    // If sending through on the sockets, this method will only ever add _response_id to the object being sent. 
    // This class expects the server to send _response_id back so that it can find callers without thunking too much. 
    // _response_id finds the requeting socket and relays the results back. 
    //
    // _response_id is specifically generated by _get_response_id(). _get_response_id returns an index for a space in 
    //  waiting_for_response array.
    //
    sendMessage(message) {   // secondary queuing is possible
        return new Promise((resolve, reject) => {
                this._message_and_response(message,resolve,reject)
        });
    }


    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----


    // external event wrapper 
    wrap_event(wrapper_key) {
        if ( this.event_wrapper && this.event_wrapper.commission ) {
            this.event_wrapper.commission(wrapper_key)
        }
    }

    unwrap_event(wrapper_key) {
        if ( this.event_wrapper && this.event_wrapper.decommission  ) {
            this.event_wrapper.decommission(wrapper_key)
        }
    }

}
