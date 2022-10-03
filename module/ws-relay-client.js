import { Communicator } from './browser-communicator'
import { EventEmitter } from 'events'


class WSWriter extends EventEmitter {

    constructor(ws) {
        super()
        this.ws = ws
    }

    //
    write(message) {
        let msg = {
            "pid" : process.pid,
            "msg" : message
        }
        try {
            this.ws.send(msg)
        } catch(e) {
            console.log(e)
        }
    }

}

// use the browser WebSocket class

export class MessageRelayer extends Communicator {
    //
    constructor(conf,wrapper) {
        super(conf,wrapper)
        this.ws = false

    }

    //
    _init(conf) {
        if ( conf === undefined ) {
            console.log("message relay client: cannot initialize -- no configuration")
            return;
        }
        this._init_members(conf)
        this._create_connection(conf)
    }

    
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    _init_members(conf) {

        this.port = conf ? conf.port || PORT : PORT
        this.address = conf ? conf.address || HOST : HOST
        this.options = conf.ws_options
        this.ws_app_path = conf.ws_path ? console.ws_path : ""
        if ( this.ws_app_path[0] != '/' ) this.ws_app_path = '/' + this.ws_app_path
        //
        //
        this.send_on_reconnect = conf ? conf.send_on_reconnect || false : false
        //
        this.attempt_reconnect = false
        this.reconnect_wait = DEFAULT_RECONNECT_WAIT
        this.max_reconnect = DEFAULT_MAX_RECONNECT
        this.reconnect_count = 0
    }


    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    _create_connection(conf) {
        this.attempt_reconnect = (conf.attempt_reconnect !== undefined) ? conf.attempt_reconnect : false
        if ( this.attempt_reconnect ) {
            this._configure_reconnect(conf)
        }
        this._connect()
        this._setup_connection_handlers(this,conf)
    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    // CONNECTION
    _connect() {
        if ( this.options ) {
            this.ws = new WebSocket(`ws://${this.address}:${this.port}${this.ws_app_path}`,this.options)
        } else {
            this.ws = new WebSocket(`ws://${this.address}:${this.port}${this.ws_app_path}`)
        }
        this.ws.onopen = () => {
            this._connection_handler()
        }
    }

    // // // // // // 

    _connection_handler() {
        this.writer = new WSWriter(this.ws)
        this.wrap_event(this.address)
        this.reconnect_count = 0
        console.log(`Client connected to: ${this.address} :  ${this.port}`);
        this.emit('client-ready',this.address,this.port)
    }

    // SET UP CONNECTION AND HANDLERS  on('close'...) on('data'...) on('error'...)
    // _setup_connection_handlers
    //
    _setup_connection_handlers(client,conf) {
        //
        // 1. data
        ws.onmessage = ((com) => { return (data) => {
            com.client_add_data_and_react(data)
        }})(this)
        //
        //  2. close
        ws.onclose = ((com) => { return () => {
            this.unwrap_event(this.address)
            console.log('Client closed');
            if ( client.attempt_reconnect ) {
                client._attempt_reconnect(conf)
            }
            com.closeAll(client_name)
        }})(this)
        //
        // 3. error
        ws.onerror = (err) => {
            this.unwrap_event(this.address)
            console.log(err);
        }
        //
    }


    closeAll() {
    }


}


